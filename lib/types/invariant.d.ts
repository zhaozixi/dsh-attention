export declare class InvariantError extends Error {
  constructor(message: string);
}

export declare function invariant(condition: unknown, message: string): asserts condition;
