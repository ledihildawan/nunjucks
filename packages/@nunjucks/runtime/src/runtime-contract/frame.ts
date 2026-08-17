/** Options for a single frame write: the dotted name, the value, and whether to resolve upward. */
export interface FrameSetOptions {
  name: string;
  value: unknown;
  resolveUp?: boolean;
}

/**
 * A variable frame: an immutable-write scope linked through `parent`. `set`
 * returns a new frame, `lookup` falls up the chain, and `resolve` locates the
 * frame that owns a binding (skipping write-isolated ancestors when resolving
 * for a write).
 */
export interface Frame {
  readonly variables: Record<string, unknown>;
  readonly parent: Frame | undefined;
  readonly topLevel: boolean;
  readonly isolateWrites: boolean | undefined;
  set: (options: FrameSetOptions) => Frame;
  get: (name: string) => unknown;
  lookup: (name: string) => unknown;
  resolve: (name: string, forWrite?: boolean) => Frame | undefined;
  push: (writeIsolation?: boolean) => Frame;
  pop: () => Frame | undefined;
}

/** Options for creating a frame: parent, write isolation, seed variables, and top-level flag. */
export interface CreateFrameOptions {
  parent?: Frame | null;
  isolateWrites?: boolean;
  variables?: Record<string, unknown>;
  topLevel?: boolean;
}
