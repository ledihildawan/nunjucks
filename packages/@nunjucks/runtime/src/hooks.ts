// WHY: `as const` keeps HookEvent a 3-literal union instead of collapsing to string.
// Only compile-phase hooks are declared — speculative load/render lifecycle events with
// no emitter were removed (YAGNI); re-add an event together with the call site that emits it.
const HOOK_EVENTS = Object.freeze({
  TEMPLATE_COMPILE_START: 'template:compile:start',
  TEMPLATE_COMPILE_COMPLETE: 'template:compile:complete',
  TEMPLATE_COMPILE_ERROR: 'template:compile:error',
} as const);

/** The compile-phase hook event names the engine emits. */
type HookEvent = (typeof HOOK_EVENTS)[keyof typeof HOOK_EVENTS];

export type { HookEvent };
export { HOOK_EVENTS };
