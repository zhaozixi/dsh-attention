/** Minimal invariant helper matching the DSH convention. */

export class InvariantError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = "InvariantError";
  }
}

/**
 * Assert a condition, throwing InvariantError on failure.
 * @param {unknown} condition - truthy check.
 * @param {string} message - failure message.
 */
export function invariant(condition, message) {
  if (!condition) throw new InvariantError(message);
}
