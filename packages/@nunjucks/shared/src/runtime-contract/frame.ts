export interface Frame {
  readonly variables: Record<string, unknown>;
  readonly parent: Frame | undefined;
  topLevel: boolean;
  readonly isolateWrites: boolean | undefined;
  set: (name: string, value: unknown, resolveUp?: boolean) => Frame;
  get: (name: string) => unknown;
  lookup: (name: string) => unknown;
  resolve: (name: string, forWrite?: boolean) => Frame | undefined;
  push: (writeIsolation?: boolean) => Frame;
  pop: () => Frame | undefined;
}

export interface CreateFrameOptions {
  parent?: Frame | null;
  isolateWrites?: boolean;
  variables?: Record<string, unknown>;
  topLevel?: boolean;
}
