/**
 * dsh-attention client plugin types (browser half).
 */

/** Client plugin body. */
export declare function apply(ctx: {
  slots: {
    inject(key: string, callback: () => () => void): void;
  };
  locale: {
    register(namespace: string, dictionaries: Record<string, Record<string, string>>): void;
  };
  effect(callback: () => () => void, label?: string): () => void;
}): void;

/** Required service names. */
export declare const inject: string[];
