/**
 * Executes compiler-generated template source via `new Function(code)` — the single
 * auditable boundary for all dynamic code evaluation in the engine. This function
 * lives in the imperative shell (src/shell/) beside the warning emitter: `new
 * Function` is a global side-channel, and keeping it here confines every
 * code-execution concern in the runtime package to one shell directory while domain
 * logic remains oblivious to code execution.
 *
 * WHY src/shell placement: the only importers are the executor runtime (domain→shell
 * seam) and the package barrel; external consumers (core) import `loadCompiledCode`
 * via `@nunjucks/runtime`, whose export surface is unchanged by the move.
 *
 * @param code - The compiled template source string produced by `@nunjucks/compiler`.
 * @returns The result of evaluating `code` in an isolated `Function` scope.
 */
const loadCompiledCode = (code: string): unknown => new Function(code)();

export { loadCompiledCode };
