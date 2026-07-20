import EventEmitter from 'events';

export const HOOK_EVENTS = Object.freeze({
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

export const globalHooks = new EventEmitter();

export const createHookEmitter = (env, options = {}) => {
  const { emitGlobal = true, envName = null } = options;

  const emitHook = (event, data = {}) => {
    const payload = {
      ...data,
      timestamp: Date.now(),
      envName,
    };

    env.emit(event, payload);

    if (emitGlobal) {
      globalHooks.emit(event, { ...payload, env: env });
    }
  };

  return { emitHook };
};

export const hookable = (fn) => {
  return fn;
};
