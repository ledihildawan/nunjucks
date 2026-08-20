/**
 * Executes compiler-generated template source via `new Function(code)` — the single
 * auditable boundary for all dynamic code evaluation in the engine. This function
 * is the imperative-shell loader; domain logic remains oblivious to code execution.
 *
 * @param code - The compiled template source string produced by `@nunjucks/compiler`.
 * @returns The result of evaluating `code` in an isolated `Function` scope.
 */
const loadCompiledCode = (code: string): unknown => new Function(code)();

export { loadCompiledCode };
