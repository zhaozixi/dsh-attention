/**
 * dsh-attention: host plugin entry.
 *
 * Registers the `attention` Cordis service: owns the TaskMonitor and the
 * ReminderEngine, exposes a small HTTP surface for the browser panel
 * (GET /api/attention/state, POST /api/attention/snooze, POST
 * /api/attention/resume), and keeps the latest suggestion / session report
 * available for the panel to poll.
 */

import { Service } from "@deepseek-ai/cordis";
import { TaskMonitor } from "./monitor.js";
import { ReminderEngine } from "./reminder-engine.js";
import { CATEGORY_ORDER, PRESET_ACTIVITIES } from "./activities.js";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

/**
 * Persistence file for the user-edited activity pool. Lives under the web
 * profile directory so it travels with the profile; the host resolves
 * `$DSH_HOME/profiles/web/attention-activities.json` (falling back to the
 * default `~/.dsh` home).
 */
function activitiesFile() {
  const home = process.env.DSH_HOME ?? join(homedir(), ".dsh");
  return join(home, "profiles", "web", "attention-activities.json");
}

/** The full activity table: persisted user edits when present, else the built-in presets. */
function loadActivities() {
  try {
    const file = activitiesFile();
    if (!existsSync(file)) return PRESET_ACTIVITIES;
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    if (Array.isArray(parsed?.activities)) return parsed.activities;
    return PRESET_ACTIVITIES;
  } catch {
    return PRESET_ACTIVITIES;
  }
}

/** Persist the full activity table. Returns false when the write fails. */
function saveActivities(activities) {
  try {
    const file = activitiesFile();
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ schemaVersion: 1, activities }, null, 2), "utf8");
    return true;
  } catch (error) {
    console.warn("[attention] activities persist failed", error);
    return false;
  }
}

/** Validate one submitted activity row; returns the normalized row or undefined. */
function normalizeActivity(row) {
  if (typeof row !== "object" || row === null) return undefined;
  const id = typeof row.id === "string" && row.id.length > 0 ? row.id : undefined;
  const category = typeof row.category === "string" && CATEGORY_ORDER.includes(row.category) ? row.category : undefined;
  if (id === undefined || category === undefined) return undefined;
  const title = typeof row.title === "string" ? { zh: row.title, en: row.title } : row.title;
  const body = typeof row.body === "string" ? { zh: row.body, en: row.body } : row.body;
  if (typeof title !== "object" || title === null || typeof title.zh !== "string") return undefined;
  const durationSec = Number.isFinite(row.durationSec) && row.durationSec > 0
    ? Math.max(1, Math.min(3600, Math.round(row.durationSec)))
    : 60;
  return {
    id,
    category,
    title: { zh: title.zh, en: typeof title.en === "string" ? title.en : title.zh },
    body: typeof body === "object" && body !== null && typeof body.zh === "string"
      ? { zh: body.zh, en: typeof body.en === "string" ? body.en : body.zh }
      : { zh: "", en: "" },
    durationSec
  };
}

/**
 * @typedef {Object} AttentionConfig
 * @property {boolean} [enabled=true]
 * @property {number} [remindIntervalMs=300000]
 * @property {number} [firstReminderDelayMs=60000]
 * @property {Array<string>} [categories]
 * @property {number} [maxActivitiesPerSession=6]
 */

/** Small JSON helper for the node:http route handlers. */
function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload)
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve) => {
    let chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

/** The attention service: monitor + engine + panel-facing HTTP surface. */
export class AttentionService extends Service {
  /**
   * @param {import("@deepseek-ai/cordis").Context} ctx
   * @param {AttentionConfig} [config]
   */
  constructor(ctx, config = {}) {
    super(ctx, "attention");
    this.config = config;
    this.monitor = null;
    this.engine = null;

    /** Polled surface state. */
    this.seq = 0;
    this.lastSuggestion = null;
    this.lastReport = null;
    this.removedRoutes = [];

    const onEvent = (event) => {
      if (event.type === "suggestion") {
        this.seq += 1;
        this.lastSuggestion = { seq: this.seq, ...event.suggestion };
        ctx.emit("attention/suggestion", event.suggestion);
      } else if (event.type === "session-report") {
        this.seq += 1;
        this.lastReport = { seq: this.seq, ...event.report };
        ctx.emit("attention/session-report", event.report);
      }
      ctx.logger?.debug?.("[attention] event", event.type);
    };

    /** Full activity table (presets + persisted user edits). */
    this.activities = loadActivities();

    this.engine = new ReminderEngine({ config, onEvent, activities: this.activities });
    this.monitor = new TaskMonitor(ctx, {
      onEvent: (event) => this.engine.handleTaskEvent(event)
    });

    this._registerRoutes(ctx);

    ctx.effect(() => () => {
      this.monitor?.dispose();
      this.engine?.dispose();
      this.monitor = null;
      this.engine = null;
      for (const remove of this.removedRoutes.splice(0)) {
        try {
          remove();
        } catch {
          /* already removed */
        }
      }
    }, "attention: lifetime");
  }

  /** Register /api/attention/* routes on the webServer service when present. */
  _registerRoutes(ctx) {
    const webServer = ctx.get?.("webServer");
    if (webServer == null || typeof webServer.register !== "function") {
      ctx.logger?.warn?.("[attention] webServer unavailable — panel route skipped (host-only mode)");
      return;
    }
    try {
      this.removedRoutes.push(
        webServer.register({
          kind: "exact",
          path: "/api/attention/state",
          handler: (req, res) => {
            if (req.method !== "GET" && req.method !== "HEAD") {
              sendJson(res, 405, { error: "method not allowed" });
              return;
            }
            sendJson(res, 200, this.state());
          }
        }),
        webServer.register({
          kind: "exact",
          path: "/api/attention/snooze",
          handler: async (req, res) => {
            if (req.method !== "POST") {
              sendJson(res, 405, { error: "method not allowed" });
              return;
            }
            await readBody(req);
            sendJson(res, 200, this.snooze());
          }
        }),
        webServer.register({
          kind: "exact",
          path: "/api/attention/resume",
          handler: async (req, res) => {
            if (req.method !== "POST") {
              sendJson(res, 405, { error: "method not allowed" });
              return;
            }
            await readBody(req);
            sendJson(res, 200, this.resume());
          }
        }),
        webServer.register({
          kind: "exact",
          path: "/api/attention/activities",
          handler: async (req, res) => {
            if (req.method === "GET" || req.method === "HEAD") {
              sendJson(res, 200, { categories: CATEGORY_ORDER, activities: this.activities });
              return;
            }
            if (req.method === "POST") {
              const body = await readBody(req);
              const submitted = Array.isArray(body?.activities) ? body.activities : null;
              if (submitted === null) {
                sendJson(res, 400, { error: "expected { activities: [...] }" });
                return;
              }
              const normalized = submitted
                .map((row) => normalizeActivity(row))
                .filter((row) => row !== undefined);
              if (!saveActivities(normalized)) {
                sendJson(res, 500, { error: "persist failed" });
                return;
              }
              this.activities = normalized;
              this.engine.activities = normalized;
              this.engine._buildPool();
              sendJson(res, 200, { ok: true, count: normalized.length });
              return;
            }
            sendJson(res, 405, { error: "method not allowed" });
          }
        }),
        webServer.register({
          kind: "exact",
          path: "/api/attention/advance",
          handler: async (req, res) => {
            if (req.method !== "POST") {
              sendJson(res, 405, { error: "method not allowed" });
              return;
            }
            await readBody(req);
            sendJson(res, 200, this.advance());
          }
        })
      );
      ctx.logger?.info?.("[attention] /api/attention/* routes registered");
    } catch (error) {
      ctx.logger?.warn?.("[attention] route registration failed", error);
    }
  }

  // ── polled state ─────────────────────────────────────────────────────────

  /** Full state snapshot served to the panel. */
  state() {
    const runningMs =
      this.engine?.sessionStartAt == null ? 0 : Date.now() - this.engine.sessionStartAt;
    return {
      enabled: this.engine?.config.enabled ?? false,
      busy: this.engine?.busy ?? false,
      runningMs,
      activeCount: this.engine?.activeTasks.length ?? 0,
      suggestedCount: this.engine?.suggestedCount ?? 0,
      poolSize: this.engine?.pool.length ?? 0,
      nextFireAt: this.engine?.nextFireAt ?? null,
      categories: this.engine?.config.categories ?? [],
      maxActivitiesPerSession: this.engine?.config.maxActivitiesPerSession ?? 6,
      lastSuggestion: this.lastSuggestion,
      lastReport: this.lastReport
    };
  }

  /** Current snapshot for the panel's initial state (kept for parity). */
  snapshot() {
    return this.state();
  }

  /** Pause the cadence (panel "snooze"). */
  snooze() {
    this.engine?.snooze();
    return { ok: true };
  }

  /** Resume the cadence. */
  resume() {
    this.engine?.resume();
    return { ok: true };
  }

  /** Advance immediately to the next suggestion (panel "done"). */
  advance() {
    this.engine?.advance();
    return { ok: true };
  }

  /** Library metadata for the panel's activity browser (persisted table). */
  library() {
    return {
      categories: CATEGORY_ORDER,
      activities: this.activities.map((activity) => ({
        id: activity.id,
        category: activity.category,
        title: activity.title.zh,
        durationSec: activity.durationSec
      }))
    };
  }
}

/**
 * Host plugin body: construct the service. The name must match the row id
 * in cordis.patch.yml ("attention").
 * @param {import("@deepseek-ai/cordis").Context} ctx
 * @param {AttentionConfig} config
 */
export function apply(ctx, config) {
  ctx.plugin(AttentionService, config);
}

/** Cordis plugin name (row id). */
export const name = "attention";

/** No hard service injection: webServer is optional (host-only mode falls back gracefully). */
export const inject = [];
