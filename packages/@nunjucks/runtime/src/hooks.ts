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

type HookEvent = (typeof HOOK_EVENTS)[keyof typeof HOOK_EVENTS];

export type { HookEvent };
export { HOOK_EVENTS };
