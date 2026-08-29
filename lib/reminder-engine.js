/**
 * dsh-attention: reminder engine.
 *
 * Turns the monitor's normalized task events into concrete reminders. While
 * at least one task is running, the engine runs a timer on the configured
 * cadence and emits an activity suggestion (rotating round-robin through the
 * active category pool, never repeating an id within a session until the
 * pool is exhausted). When every task settles, the engine emits a session
 * report and stops.
 *
 * All scheduling lives here (host side); the client panel is a passive
 * renderer of the engine's emitted events.
 */

import { PRESET_ACTIVITIES, presetsByCategory } from "./activities.js";

/**
 * @typedef {Object} ReminderConfig
 * @property {boolean} [enabled=true] - master switch.
 * @property {number} [remindIntervalMs=300000] - cadence between suggestions (5 min).
 * @property {number} [firstReminderDelayMs=60000] - delay after task start for the first suggestion.
 * @property {Array<"micro-movement"|"mind-refresh"|"micro-learning"|"quick-organize">} [categories] - active category pool.
 * @property {number} [maxActivitiesPerSession=6] - hard cap of suggestions per session.
 */

/**
 * @typedef {Object} ActivitySuggestion
 * @property {string} id - activity id.
 * @property {string} category - activity category.
 * @property {string} title - activity headline (zh).
 * @property {string} body - one-line copy (zh).
 * @property {number} durationSec - suggested duration.
 * @property {number} suggestedAt - epoch ms of the suggestion.
 * @property {number} runningMs - how long the current task window has been open.
 */

/** Default config merged with user config at construction. */
const DEFAULT_CONFIG = /** @type {ReminderConfig} */ ({
  enabled: true,
  remindIntervalMs: 300000,
  firstReminderDelayMs: 5000,
  categories: ["micro-movement", "mind-refresh", "micro-learning", "quick-organize"],
  maxActivitiesPerSession: 6
});

/**
 * The reminder engine.
 * @param {Object} [options]
 * @param {ReminderConfig} [options.config] - engine config.
 * @param {(event: Object) => void} [options.onEvent] - sink for engine events
 *   ({type: "suggestion", suggestion} | {type: "session-report", report}).
 */
export class ReminderEngine {
  /**
   * @param {Object} [options]
   * @param {ReminderConfig} [options.config] - engine config.
   * @param {(event: Object) => void} [options.onEvent] - sink for engine events.
   * @param {Activity[]} [options.activities] - full activity table (presets
   *   plus user-defined); when present it replaces the built-in preset table
   *   as the source for pool building and suggestion lookup.
   */
  constructor(options = {}) {
    /** @type {ReminderConfig} */
    this.config = { ...DEFAULT_CONFIG, ...(options.config ?? {}) };
    this.onEvent = options.onEvent ?? (() => {});
    /** Full activity table; undefined falls back to the built-in presets. */
    this.activities = options.activities ?? null;

    /** @type {Array<{kind: string, label?: string, startedAt: number}>} */
    this.activeTasks = [];
    this.sessionStartAt = null;
    this.timer = null;
    this.nextFireAt = null;

    /** Round-robin pool of activity ids for the current session. */
    this.pool = [];
    this.poolCursor = 0;
    this.suggestedIds = new Set();
    this.suggestedCount = 0;
    this.disposed = false;

    this._buildPool();
  }

  /**
   * Build the shuffled pool from the active category config and the
   * configured activity table (or the built-in presets when none is given).
   * A user-supplied table replaces the presets entirely, so edited copy and
   * added/removed activities are exactly what gets suggested. The pool is
   * shuffled so suggestion order is random within a session (the engine
   * still never repeats an id until the pool is exhausted).
   */
  _buildPool() {
    const categories = this.config.categories ?? DEFAULT_CONFIG.categories;
    const table = this.activities ?? PRESET_ACTIVITIES;
    const pool = [];
    for (const category of categories) {
      for (const activity of table) {
        if (activity.category === category) pool.push(activity.id);
      }
    }
    this.pool = pool;
    this._shufflePool();
    this.poolCursor = 0;
  }

  /** Fisher–Yates shuffle of the suggestion pool, in place. */
  _shufflePool() {
    for (let i = this.pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = this.pool[i];
      this.pool[i] = this.pool[j];
      this.pool[j] = tmp;
    }
  }

  /**
   * Look up one activity by id: the configured table first (which includes
   * presets when it was built from them), then the built-in presets.
   * @param {string} id - activity id.
   * @returns {Activity|undefined}
   */
  _lookup(id) {
    if (this.activities != null) {
      const found = this.activities.find((activity) => activity.id === id);
      if (found !== undefined) return found;
    }
    return PRESET_ACTIVITIES.find((activity) => activity.id === id);
  }

  /** True while at least one task is running. */
  get busy() {
    return this.activeTasks.length > 0;
  }

  /**
   * Feed a normalized task event.
   * @param {{type: "task-start"|"task-end", task: Object}} event - from the monitor.
   */
  handleTaskEvent(event) {
    if (this.disposed) return;
    if (event.type === "task-start") {
      this._handleStart(event.task);
    } else {
      this._handleEnd(event.task);
    }
  }

  _handleStart(task) {
    // Idempotent: a task edge already tracked (e.g. a goal seeded after a
    // host restart, then re-emitted live) must not double-open the window.
    const existing = this.activeTasks.findIndex(
      (active) => active.kind === task.kind && (task.label === undefined || active.label === task.label)
    );
    if (existing !== -1) {
      this.activeTasks[existing].startedAt = task.startedAt;
      return;
    }
    const first = this.activeTasks.length === 0;
    this.activeTasks.push({ kind: task.kind, label: task.label, startedAt: task.startedAt });
    if (first) {
      this.sessionStartAt = task.startedAt;
      this.suggestedIds.clear();
      this.suggestedCount = 0;
      this.poolCursor = 0;
      // Fresh random order for each new session.
      this._shufflePool();
      this._scheduleNext(this.config.firstReminderDelayMs);
    }
  }

  _handleEnd(task) {
    const index = this.activeTasks.findIndex(
      (active) => active.kind === task.kind && (task.label === undefined || active.label === task.label)
    );
    if (index === -1) {
      // A settling event without a tracked start: drop the oldest of its kind,
      // or clear the window if nothing matches at all.
      if (this.activeTasks.length > 0) this.activeTasks.shift();
    } else {
      this.activeTasks.splice(index, 1);
    }
    if (this.activeTasks.length === 0) this._finishSession();
  }

  _scheduleNext(delayMs) {
    if (this.disposed) return;
    this._clearTimer();
    if (!this.config.enabled) return;
    this.nextFireAt = Date.now() + delayMs;
    this.timer = setTimeout(() => {
      this.timer = null;
      this._fireSuggestion();
    }, delayMs);
  }

  _fireSuggestion() {
    if (this.disposed || this.activeTasks.length === 0) return;
    if (this.suggestedCount >= (this.config.maxActivitiesPerSession ?? DEFAULT_CONFIG.maxActivitiesPerSession)) {
      // Cap reached: keep the window open but stop suggesting.
      return;
    }
    const suggestion = this._nextSuggestion();
    if (suggestion == null) {
      // Pool exhausted (all ids suggested): stop the cadence for this session.
      return;
    }
    this.onEvent({ type: "suggestion", suggestion });
    this._scheduleNext(this.config.remindIntervalMs);
  }

  /**
   * Pick the next unsuggested activity id from the shuffled pool. Returns
   * null when the whole pool has been suggested.
   * @returns {Object|null}
   */
  _nextSuggestion() {
    if (this.pool.length === 0) return null;
    const start = this.poolCursor;
    for (let step = 0; step < this.pool.length; step++) {
      const id = this.pool[(this.poolCursor + step) % this.pool.length];
      if (!this.suggestedIds.has(id)) {
        this.poolCursor = (this.poolCursor + step + 1) % this.pool.length;
        this.suggestedIds.add(id);
        this.suggestedCount += 1;
        const activity = this._lookup(id) ?? PRESET_ACTIVITIES[0];
        return {
          id: activity.id,
          category: activity.category,
          title: activity.title.zh,
          body: activity.body.zh,
          durationSec: activity.durationSec,
          suggestedAt: Date.now(),
          runningMs: Date.now() - this.sessionStartAt
        };
      }
    }
    return null;
  }

  _finishSession() {
    this._clearTimer();
    this.nextFireAt = null;
    const durationMs = this.sessionStartAt == null ? 0 : Date.now() - this.sessionStartAt;
    const report = {
      durationMs,
      suggestedCount: this.suggestedCount,
      activities: [...this.suggestedIds],
      endedAt: Date.now()
    };
    this.sessionStartAt = null;
    this.onEvent({ type: "session-report", report });
  }

  /** Pause the cadence without ending the session (panel "snooze"). */
  snooze() {
    this._clearTimer();
    this.nextFireAt = null;
  }

  /** Resume the cadence after snooze. */
  resume() {
    if (this.busy) this._scheduleNext(this.config.remindIntervalMs);
  }

  /**
   * Advance immediately to the next suggestion (panel "done"): clear the
   * pending timer and fire the next activity right away instead of waiting
   * for the cadence. No-ops when idle, capped, or pool-exhausted — the
   * engine state and normal cadence are left untouched in those cases.
   */
  advance() {
    if (this.disposed || this.activeTasks.length === 0) return;
    this._clearTimer();
    this._fireSuggestion();
  }

  _clearTimer() {
    if (this.timer != null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.nextFireAt = null;
  }

  /** Stop all timers and mark disposed. */
  dispose() {
    this.disposed = true;
    this._clearTimer();
    this.activeTasks = [];
  }
}
