// WHY: shell placement — probing the host `process` global is an environment
// side-effect (mirrors the render/shell and diagnostics/shell seams); factory.ts
// stays free of direct global reads and imports this one-way.
/** Reads `NODE_ENV` from the host process, defaulting to `development` in non-Node runtimes (browsers/edge). */
export const readRuntimeEnvironment = (): string =>
  typeof process === 'undefined' ? 'development' : (process.env.NODE_ENV ?? 'development');
