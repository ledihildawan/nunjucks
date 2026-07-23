export const extractBlocks = (obj: Record<string, unknown>): Record<string, unknown> => {
  const blocks: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (key.startsWith('b_')) {
      blocks[key.slice(2)] = obj[key];
    }
  }
  return blocks;
};

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
  _renderingTemplates: Set<string>;
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
