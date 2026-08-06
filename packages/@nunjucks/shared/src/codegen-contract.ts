/**
 * Contract between the compiler (which emits JS source as strings) and the
 * runtime (which executes that JS via `new Function`).
 *
 * The compiler emits calls like `runtime.suppressValue(...)`, `runtime.keys(...)`
 * and a top-level signature `async function root(env, context, frame, runtime)`.
 * Without a shared contract these agreements live as string literals scattered
 * across both packages — renaming a helper or the `root` function silently
 * breaks the pipeline. The types and constants here pin the contract down.
 */

/**
 * Magic key under which block metadata is attached to a compiled template's
 * returned exports object. Emitted by the compiler root statement and read by
 * the runtime executor + the core template compiler.
 */
export const BLOCK_META_KEY = '__blockMeta';

/**
 * Signature shared by every compiled template body function — the root template
 * and each `{% block %}` body. The compiler wraps generated code in
 * `async function <name>(env, context, frame, runtime)`; this type documents
 * that shape so both sides agree on parameter order.
 *
 * Parameters are intentionally `unknown` here: the concrete `Env`, `Context`,
 * `Frame`, and runtime-helpers shapes live in `@nunjucks/runtime` + `@nunjucks/core`
 * (depending on them from `@nunjucks/shared` would create a cycle).
 */
export type CompiledRenderSignature = (
  env: unknown,
  context: unknown,
  frame: unknown,
  runtime: unknown,
) => Promise<unknown> | unknown;

/**
 * Shape of the object a compiled template returns. The compiler emits
 * `return { root, b_<name>, __blockMeta }` and the runtime reads it back via
 * `new Function(code)()`.
 */
export interface CompiledTemplateExports {
  /** Root template render function. */
  root: CompiledRenderSignature;
  /** Per-block render functions, keyed by `b_<blockName>`. */
  [blockName: string]: CompiledRenderSignature | Record<string, unknown>;
  /** Block metadata emitted by the compiler (locations, source info). */
  [BLOCK_META_KEY]: Record<string, unknown>;
}
