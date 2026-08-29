/**
 * dsh-attention host plugin types.
 */

import type { Context } from "@deepseek-ai/cordis";

/** Activity category keys. */
export type ActivityCategory =
  | "micro-movement"
  | "mind-refresh"
  | "micro-learning"
  | "quick-organize"
  | "custom";

/** Host plugin config (mirrors cordis.patch.yml row config). */
export interface AttentionConfig {
  /** Master switch. Default true. */
  enabled?: boolean;
  /** Cadence between suggestions in ms. Default 300000 (5 min). */
  remindIntervalMs?: number;
  /** Delay after task start for the first suggestion. Default 5000. */
  firstReminderDelayMs?: number;
  /** Active category pool. */
  categories?: ActivityCategory[];
  /** Hard cap of suggestions per session. Default 6. */
  maxActivitiesPerSession?: number;
}

/** One suggestion emitted by the reminder engine. */
export interface ActivitySuggestion {
  id: string;
  category: string;
  title: string;
  body: string;
  durationSec: number;
  suggestedAt: number;
  runningMs: number;
}

/** Session report emitted when every task settles. */
export interface SessionReport {
  durationMs: number;
  suggestedCount: number;
  activities: string[];
  endedAt: number;
}

/** The attention Cordis service. */
export declare class AttentionService {
  constructor(ctx: Context, config?: AttentionConfig);
  snapshot(): Record<string, unknown>;
  state(): Record<string, unknown>;
  snooze(): { ok: boolean };
  resume(): { ok: boolean };
  advance(): { ok: boolean };
}

/** Host plugin body. */
export declare function apply(ctx: Context, config?: AttentionConfig): void;
