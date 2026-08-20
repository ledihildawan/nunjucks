/**
 * Compile-phase hook event names the engine emits. Each value is a frozen string
 * literal (preserved via `as const`) so `HookEvent` stays a 3-member union rather
 * than widening to `string`. Only compile-phase hooks are declared — speculative
 * load/render lifecycle events with no emitter were removed (YAGNI).
 */
const HOOK_EVENTS = Object.freeze({
  TEMPLATE_COMPILE_START: 'template:compile:start',
  TEMPLATE_COMPILE_COMPLETE: 'template:compile:complete',
  TEMPLATE_COMPILE_ERROR: 'template:compile:error',
} as const);

/** The compile-phase hook event names the engine emits. */
type HookEvent = (typeof HOOK_EVENTS)[keyof typeof HOOK_EVENTS];

export type { HookEvent };
export { HOOK_EVENTS };
