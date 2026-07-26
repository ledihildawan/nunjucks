import EventEmitter from 'node:events';

const HOOK_EVENTS = Object.freeze({
  TEMPLATE_LOADING: 'template:loading',
  TEMPLATE_LOADED: 'template:loaded',
  TEMPLATE_LOAD_ERROR: 'template:load:error',
  TEMPLATE_COMPILE_START: 'template:compile:start',
  TEMPLATE_COMPILE_COMPLETE: 'template:compile:complete',
  TEMPLATE_COMPILE_ERROR: 'template:compile:error',
  RENDER_START: 'render:start',
  RENDER_COMPLETE: 'render:complete',
  RENDER_ERROR: 'render:error',
});

type HookEvent = typeof HOOK_EVENTS[keyof typeof HOOK_EVENTS];

const globalHooks = new EventEmitter();

interface HookEmitter {
  emit: (event: string, payload: Record<string, unknown>) => boolean;
}

interface CreateHookEmitterOptions {
  emitGlobal?: boolean;
  envName?: string | null;
}

const createHookEmitter = (env: HookEmitter, options: CreateHookEmitterOptions = {}) => {
  const { emitGlobal = true, envName = null } = options;

  const emitHook = (event: string, data: Record<string, unknown> = {}): void => {
    const payload = {
      ...data,
      timestamp: Date.now(),
      envName,
    };

    env.emit(event, payload);

    if (emitGlobal) {
      globalHooks.emit(event, { ...payload, env });
    }
  };

  return { emitHook };
};

const hookable = <T extends (...args: unknown[]) => unknown>(fn: T): T => fn;

export { HOOK_EVENTS, globalHooks, createHookEmitter, hookable };
export type { HookEvent };
