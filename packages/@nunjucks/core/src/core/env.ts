export { extractBlocks } from '@nunjucks/shared';

export interface EnvOptions {
  dev?: boolean;
  autoescape?: boolean;
  undefined?: string;
  [key: string]: unknown;
}

export type GetTemplateFn = (name: string, eagerCompile?: boolean, includeChain?: unknown[] | null, ignoreMissing?: boolean) => unknown;

export interface Env {
  opts: EnvOptions;
  extensionsList: unknown[];
  globals: Record<string, unknown>;
  /** Guards against circular includes. Path-less (inline) templates share the
   *  single `undefined` key, which is why the element type admits it. */
  _renderingTemplates: Set<string | undefined>;
  loaders?: unknown[];
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  emit?: (event: string, ...args: unknown[]) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  getTemplate?: GetTemplateFn;
}

export const createEnv = ({ opts = {}, globals = {}, emitter = null, getTemplate = null }: {
  opts?: EnvOptions;
  globals?: Record<string, unknown>;
  emitter?: { on: (event: string, handler: (...args: unknown[]) => void) => void; emit: (event: string, ...args: unknown[]) => void; removeListener: (event: string, handler: (...args: unknown[]) => void) => void } | null;
  getTemplate?: GetTemplateFn | null;
} = {}): Env => {
  const env: Env = {
    opts,
    extensionsList: [],
    globals,
    _renderingTemplates: new Set(),
  };
  if (emitter) {
    env.on = (event, handler) => emitter.on(event, handler);
    env.emit = (event, ...args) => emitter.emit(event, ...args);
    env.removeListener = (event, handler) => emitter.removeListener(event, handler);
  }
  if (getTemplate) {
    env.getTemplate = getTemplate;
  }
  return env;
};
