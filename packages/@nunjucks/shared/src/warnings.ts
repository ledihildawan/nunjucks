// WHY: internal collector key for warnings accumulated during a single render pass.
// The runtime creates the array, the warning emitter appends to it, and the template
// renderer drains it after render. Unlike the browser-side `__nunjucks_warnings__`
// sentinel emitted by the warning script, this key never crosses a serialization
// boundary — single-sourced here so the three packages cannot drift apart.
const WARNINGS_CONTEXT_KEY = '__warnings__';

export { WARNINGS_CONTEXT_KEY };
