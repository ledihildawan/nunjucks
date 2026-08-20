import type { Node } from '@nunjucks/nodes';
import type { Emitter, ScopeManager } from './index.ts';

/**
 * Emits the async-generator prologue for root and block functions, opening
 * the `try {` the matching `emitCompilerFuncEnd` closes and resetting
 * `buffer`/`scopeStack` to generator-scope state (`buffer === null`).
 */
export const emitCompilerFuncBegin = (
  compiler: Emitter & ScopeManager,
  node: Node,
  name: string
): void => {
  // WHY: Option C — both root and block functions are async generators that yield output chunks (buffer === null signals 'yield' to appendTarget). Only capture/slot set their own local buffer to accumulate a string. Diverging root vs block is no longer needed.
  compiler.buffer = null;
  compiler.scopeStack = [];
  compiler.emitLine(`async function* ${name}(env, context, frame, runtime) {`);
  compiler.emitLine(`let lineno = ${node.lineno};`);
  compiler.emitLine(`let colno = ${node.colno ?? 0};`);
  compiler.emitLine('try {');
};

/**
 * Emits the function epilogue: `closeScopeLevels`'s closers, the
 * `runtime.handleError` catch, and the closing brace. No pending-buffer
 * `return` is emitted — every `emitCompilerFuncBegin` sets `buffer` to
 * `null` (async generators return via delegation, not a buffer), so the
 * epilogue always closes in generator state.
 */
export const emitCompilerFuncEnd = (
  compiler: Emitter & ScopeManager,
  // WHY: legacy flag kept for ScopeManager's `emitFuncEnd(noReturn?)` signature; it only
  // ever guarded the removed pending-buffer return, which is unreachable since begin
  // always nulls the buffer.
  _noReturn?: boolean
): void => {
  compiler.closeScopeLevels();
  compiler.emitLine('} catch (e) {');
  compiler.emitLine('  throw runtime.handleError(e, { lineno, colno });');
  compiler.emitLine('}');
  compiler.emitLine('}');
  compiler.buffer = null;
};

/** Records one `})` scope closer for `closeCompilerScopeLevels` to emit later. */
export const addCompilerScopeLevel = (compiler: Pick<ScopeManager, 'scopeStack'>): void => {
  compiler.scopeStack.push('})');
};

/** Emits and clears all pending scope closers in one joined statement. */
export const closeCompilerScopeLevels = (
  compiler: Pick<ScopeManager, 'scopeStack'> & Pick<Emitter, 'emitLine'>
): void => {
  if (compiler.scopeStack.length > 0) {
    compiler.emitLine(`${compiler.scopeStack.join('')};`);
    compiler.scopeStack = [];
  }
};

/** Runs `func` against a fresh scope stack, closing its levels before restoring the outer one. */
export const withCompilerScopedSyntax = (
  compiler: Pick<ScopeManager, 'scopeStack' | 'closeScopeLevels'>,
  func: () => void
): void => {
  const savedScope = compiler.scopeStack;
  compiler.scopeStack = [];
  func();
  compiler.closeScopeLevels();
  compiler.scopeStack = savedScope;
};
