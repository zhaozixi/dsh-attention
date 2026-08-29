/**
 * dsh-attention: task execution monitor.
 *
 * Watches the observable task signals in a DSH process — goal round
 * transitions, background job lifecycle, agent activity, and (via its own
 * state endpoint) task-board tasks — and turns them into a normalized
 * stream of task events:
 *
 *   task-start  (kind, label)
 *   task-end    (kind, label)
 *
 * The reminder engine consumes this stream. The monitor is deliberately
 * conservative: it only reacts to signals it can actually observe (via the
 * host's event bus / services), and never fabricates state. When a signal
 * source is absent (e.g. a profile without the goal service), that source
 * is simply skipped.
 */

/**
 * @typedef {"goal"|"job"|"agent"|"task-board"} TaskKind
 * @typedef {Object} TaskStart
 * @property {TaskKind} kind - what started.
 * @property {string} [label] - human label (goal objective, job label, agent id).
 * @property {number} startedAt - epoch ms.
 * @typedef {Object} TaskEnd
 * @property {TaskKind} kind - what ended.
 * @property {string} [label] - same label as the matching start, if known.
 * @property {number} endedAt - epoch ms.
 * @property {boolean} completed - whether it ended successfully.
 */

/**
 * Normalized task monitor.
 *
 * @param {import("@deepseek-ai/cordis").Context} ctx - host context.
 * @param {Object} [options]
 * @param {(event: {type: "task-start", task: TaskStart} | {type: "task-end", task: TaskEnd}) => void} options.onEvent - sink for normalized events.
 */
export class TaskMonitor {
  /**
   * @param {import("@deepseek-ai/cordis").Context} ctx
   * @param {Object} [options]
   */
  constructor(ctx, options = {}) {
    this.ctx = ctx;
    this.onEvent = options.onEvent ?? (() => {});
    this.disposers = [];
    this._attachGoalSignals();
    this._attachJobSignals();
    this._attachAgentSignals();
    this._attachTaskBoardSignals();
  }

  /**
   * Goal signals. The goal service publishes `goal/changed` (scoped event,
   * payload `{ agent, change }`) for every durable goal transition. Map
   * operations to task edges: create / resume open a task window; complete /
   * block / clear close it.
   */
  _attachGoalSignals() {
    const ctx = this.ctx;
    if (ctx.on == null) return;
    const onGoalChanged = (payload) => {
      const change = payload?.change;
      const operation = change?.operation;
      const goal = change?.goal;
      // Use the stable goal id as the window key: the objective may be
      // edited between start and end, and a `clear` change carries the
      // tombstone on `cleared` (no `goal` field) — both would orphan the
      // window if the label were the objective.
      const goalId = goal?.id ?? change?.cleared?.id;
      if (operation === "create" || operation === "resume") {
        this.onEvent({
          type: "task-start",
          task: {
            kind: "goal",
            label: goalId,
            startedAt: Date.now()
          }
        });
      } else if (operation === "complete" || operation === "block" || operation === "clear") {
        this.onEvent({
          type: "task-end",
          task: {
            kind: "goal",
            label: goalId,
            endedAt: Date.now(),
            completed: operation === "complete"
          }
        });
      }
    };
    try {
      this.disposers.push(ctx.on("goal/changed", onGoalChanged));
      this._seedActiveGoals();
    } catch (error) {
      // Event names may not be declared in this profile; skip quietly.
      this.ctx.logger?.warn?.("[attention] goal signal attach skipped", error);
    }
  }

  /**
   * Recover already-active goals after a host restart. The goal service
   * persists its state and only emits `goal/changed` on transitions, so a
   * goal created before a restart never re-fires — without a seed query the
   * engine would stay idle while DSH keeps executing that goal. Enumerate
   * live agents and synthesize task-start for every goal in the `active`
   * phase (the engine's idempotent start prevents doubles with live events).
   */
  _seedActiveGoals() {
    try {
      const agents = this.ctx.get?.("agents");
      const goals = this.ctx.get?.("goals");
      if (agents == null || typeof agents.list !== "function") return;
      if (goals == null || typeof goals.get !== "function") return;
      for (const agent of agents.list()) {
        let goal;
        try {
          goal = goals.get(agent);
        } catch {
          continue; // agent may be mid-lifecycle; skip quietly.
        }
        if (goal != null && goal.phase === "active") {
          this.onEvent({
            type: "task-start",
            task: {
              kind: "goal",
              label: goal.id,
              startedAt: Date.now()
            }
          });
        }
      }
    } catch (error) {
      this.ctx.logger?.warn?.("[attention] goal seed skipped", error);
    }
  }

  /**
   * Background job signals. The jobs registry (@deepseek-ai/dsh-jobs-local)
   * exposes the `jobs` service with observer callbacks, not bus events:
   * `onJobsChanged(owner)` fires on any visible-set change and
   * `onJobDone(snapshot, owner)` on settlement. Synthesize task-start from
   * newly-running snapshots (`list(owner)`), and task-end from the terminal
   * snapshot the settlement callback delivers — one edge per job, no
   * cross-owner visibility guessing.
   */
  _attachJobSignals() {
    const ctx = this.ctx;
    const jobs = ctx.get?.("jobs");
    if (jobs == null
      || typeof jobs.list !== "function"
      || typeof jobs.onJobsChanged !== "function"
      || typeof jobs.onJobDone !== "function") {
      this.ctx.logger?.warn?.("[attention] jobs service unavailable — job signals skipped");
      return;
    }

    /** Job ids already reported as task-start, to emit each edge once. */
    const knownRunning = new Set();

    const detectStart = (owner) => {
      let snapshots = [];
      try {
        snapshots = jobs.list(owner);
      } catch (error) {
        this.ctx.logger?.warn?.("[attention] jobs.list failed", error);
        return;
      }
      for (const snapshot of snapshots) {
        if ((snapshot.status === "running" || snapshot.status === "stopping")
          && !knownRunning.has(snapshot.id)) {
          knownRunning.add(snapshot.id);
          this.onEvent({
            type: "task-start",
            task: {
              kind: "job",
              label: snapshot.label ?? snapshot.id,
              startedAt: snapshot.startedAt ?? Date.now()
            }
          });
        }
      }
    };

    try {
      // A change notification arrives per owner whose set changed; `list(owner)`
      // includes unowned jobs too, so one pass per notification suffices.
      this.disposers.push(jobs.onJobsChanged((owner) => detectStart(owner)));
      // Settlement delivers the exact terminal snapshot — the authoritative
      // task-end edge (completed / killed / failed).
      this.disposers.push(jobs.onJobDone((snapshot) => {
        knownRunning.delete(snapshot.id);
        this.onEvent({
          type: "task-end",
          task: {
            kind: "job",
            label: snapshot.label ?? snapshot.id,
            endedAt: snapshot.finishedAt ?? Date.now(),
            completed: snapshot.status === "completed"
          }
        });
      }));
      // Seed with jobs already running at attach time (unowned bucket; owned
      // jobs surface through their owner's next notification).
      detectStart(undefined);
    } catch (error) {
      this.ctx.logger?.warn?.("[attention] jobs service signals skipped", error);
    }
  }

  /**
   * Agent activity signals. `agent/status` fires on every agent state
   * transition (idle ↔ running) for every live agent — the main session, a
   * background subagent, or a task-board execution session. It is the
   * superset signal: a running agent is a running task. Subagent start/end
   * events are deliberately NOT listened to separately — every subagent is
   * an agent, so `agent/status` already covers them without double-counting.
   * A restart seed re-opens windows for agents that are running at attach
   * time (e.g. the user continuing a conversation after DSH rebooted).
   */
  _attachAgentSignals() {
    const ctx = this.ctx;
    if (ctx.on == null) return;
    /** Agent ids currently tracked as running (startedAt updated in place). */
    const runningAgents = new Set();
    const onStatus = (payload) => {
      const agent = payload?.agent;
      const status = payload?.status;
      const id = agent?.id;
      if (id === undefined || status === undefined) return;
      if (status === "running") {
        if (runningAgents.has(id)) return;
        runningAgents.add(id);
        this.onEvent({
          type: "task-start",
          task: { kind: "agent", label: id, startedAt: Date.now() }
        });
      } else if (status === "idle") {
        if (!runningAgents.has(id)) return;
        runningAgents.delete(id);
        this.onEvent({
          type: "task-end",
          task: { kind: "agent", label: id, endedAt: Date.now(), completed: true }
        });
      }
    };
    try {
      this.disposers.push(ctx.on("agent/status", onStatus));
      // An agent that is disposed while still `running` never passes through
      // an `idle` transition (disposal is not a third status) — without this
      // listener the engine would keep a stale open window and the panel
      // would stay up forever after the session is closed or deleted.
      this.disposers.push(ctx.on("agent/disposed", (payload) => {
        const id = payload?.agent?.id;
        if (id === undefined || !runningAgents.has(id)) return;
        runningAgents.delete(id);
        this.onEvent({
          type: "task-end",
          task: { kind: "agent", label: id, endedAt: Date.now(), completed: true }
        });
      }));
      this._seedRunningAgents(runningAgents);
    } catch (error) {
      this.ctx.logger?.warn?.("[attention] agent signal attach skipped", error);
    }
  }

  /**
   * Recover agents that are already running when the monitor attaches (host
   * restart while a conversation turn / subagent / task-board session is in
   * flight). `agent/status` does not replay; query the agent registry and
   * synthesize task-start for every `running` agent. The engine's idempotent
   * start prevents doubles with subsequent live events.
   * @param {Set<string>} runningAgents - the in-memory running-id set.
   */
  _seedRunningAgents(runningAgents) {
    try {
      const agents = this.ctx.get?.("agents");
      if (agents == null || typeof agents.list !== "function") return;
      for (const agent of agents.list()) {
        if (agent?.status === "running") {
          runningAgents.add(agent.id);
          this.onEvent({
            type: "task-start",
            task: { kind: "agent", label: agent.id, startedAt: Date.now() }
          });
        }
      }
    } catch (error) {
      this.ctx.logger?.warn?.("[attention] agent seed skipped", error);
    }
  }

  /**
   * Task-board signals. The task-board plugin (@linxin666/dsh-client-ui-task-board)
   * is a self-contained system — its own cron scheduler, spawn-managed child
   * processes, and /api/task-board/* routes — that does NOT publish through
   * the DSH jobs service, goal events, or subagent events. Bridge it by
   * polling its state endpoint (loopback request carrying the same-origin
   * markers its trust fence requires) and diffing the running task set into
   * task-start / task-end edges. The poll is skipped entirely when the
   * endpoint is unreachable (task-board not installed), so the monitor keeps
   * working on profiles without it.
   */
  _attachTaskBoardSignals() {
    const pollMs = 3000;
    /** Task id → last observed running snapshot, for edge diffing. */
    const runningTasks = new Map();
    const stateUrl = "http://127.0.0.1:3080/api/task-board/state";
    let timer = null;
    /** Guards against overlapping polls when a fetch outlives the interval. */
    let inFlight = false;

    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      let payload = null;
      try {
        const response = await fetch(stateUrl, {
          headers: {
            "origin": "http://127.0.0.1:3080",
            "sec-fetch-site": "same-origin"
          },
          signal: AbortSignal.timeout(4000)
        });
        if (!response.ok) return;
        payload = await response.json();
      } catch {
        // Task-board absent or unreachable; stay silent and retry next tick.
        return;
      } finally {
        inFlight = false;
      }
      const tasks = Array.isArray(payload?.tasks) ? payload.tasks : [];
      const liveIds = new Set();
      for (const task of tasks) {
        liveIds.add(task.id);
        const active = task.status === "running";
        const known = runningTasks.get(task.id);
        if (active && known === undefined) {
          runningTasks.set(task.id, task);
          this.onEvent({
            type: "task-start",
            task: {
              kind: "task-board",
              // Use the task id (unique) as the window key; identical titles
              // on concurrent tasks must not merge into one window.
              label: task.id,
              startedAt: task.updatedAt ?? Date.now()
            }
          });
        } else if (!active && known !== undefined) {
          runningTasks.delete(task.id);
          this.onEvent({
            type: "task-end",
            task: {
              kind: "task-board",
              label: task.id,
              endedAt: task.updatedAt ?? Date.now(),
              completed: task.status === "done"
            }
          });
        }
      }
      // Tasks removed from the ledger while tracked as running.
      for (const [id, snapshot] of runningTasks) {
        if (!liveIds.has(id)) {
          runningTasks.delete(id);
          this.onEvent({
            type: "task-end",
            task: {
              kind: "task-board",
              label: id,
              endedAt: Date.now(),
              completed: false
            }
          });
        }
      }
    };

    this.disposers.push(() => {
      if (timer !== null) clearInterval(timer);
      runningTasks.clear();
    });
    // Immediate seed poll, then the cadence.
    void poll();
    timer = setInterval(() => void poll(), pollMs);
  }

  /** Detach every registered signal. */
  dispose() {
    for (const dispose of this.disposers.splice(0)) {
      try {
        if (typeof dispose === "function") dispose();
      } catch (error) {
        this.ctx.logger?.warn?.("[attention] signal detach failed", error);
      }
    }
  }
}
