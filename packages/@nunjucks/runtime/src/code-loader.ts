// WHY: new Function() is the imperative-shell code loader that executes compiler-generated template source. Isolating it at this single auditable boundary keeps all dynamic code evaluation in one named, reviewable place rather than scattered through domain logic.
const loadCompiledCode = (code: string): unknown => new Function(code)();

export { loadCompiledCode };
