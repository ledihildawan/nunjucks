import { describe, expect, test } from 'bun:test';
import { literal } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import {
  addCompilerScopeLevel,
  closeCompilerScopeLevels,
  emitCompilerFuncBegin,
  emitCompilerFuncEnd,
  withCompilerScopedSyntax,
} from './statement-emitter.ts';

const makeScope = () => {
  const emitted: string[] = [];
  const scope = {
    emitted,
    buffer: 'output',
    scopeStack: [] as string[],
    emitLine: (s: string) => {
      emitted.push(`${s}\n`);
    },
    closeScopeLevels: () => {
      if (scope.scopeStack.length > 0) {
        scope.emitLine(`${scope.scopeStack.join('')};`);
        scope.scopeStack = [];
      }
    },
  };
  return scope;
};

describe('emitCompilerFuncBegin', () => {
  test('root emits an async generator header with no output buffer', () => {
    const c = makeScope();
    emitCompilerFuncBegin(c as never, literal(loc({ lineno: 2, colno: 4 }), ''), 'root');
    expect(c.buffer).toBeNull();
    expect(c.scopeStack).toEqual([]);
    const joined = c.emitted.join('');
    expect(joined).toContain('async function* root(env, context, frame, runtime) {');
    expect(joined).toContain('let lineno = 2;');
    expect(joined).toContain('let colno = 4;');
    expect(joined).not.toContain('let output = "";');
    expect(joined).toContain('try {');
  });

  test('block emits an async generator header with no output buffer', () => {
    const c = makeScope();
    emitCompilerFuncBegin(c as never, literal(loc({ lineno: 2, colno: 4 }), ''), 'b_content');
    expect(c.buffer).toBeNull();
    const joined = c.emitted.join('');
    expect(joined).toContain('async function* b_content(env, context, frame, runtime) {');
    expect(joined).not.toContain('let output = "";');
  });
});

describe('emitCompilerFuncEnd', () => {
  test('emits catch + closing brace and nulls the buffer', () => {
    const c = makeScope();
    c.scopeStack.push('})');
    emitCompilerFuncEnd(c as never);
    const joined = c.emitted.join('');
    expect(joined).toContain('});');
    expect(joined).toContain('} catch (e) {');
    expect(joined).toContain('throw runtime.handleError');
    expect(c.buffer).toBeNull();
  });

  test('never emits a pending-buffer return even when buffer is non-null', () => {
    // WHY: regression — the epilogue used to emit `return <buffer>` when buffer was
    // set, but emitCompilerFuncBegin always nulls it, so the branch was dead; a stray
    // buffer must not reintroduce a return into an async generator epilogue.
    const c = makeScope();
    c.buffer = 'stray';
    emitCompilerFuncEnd(c as never);
    expect(c.emitted.join('')).not.toContain('return stray;');
    expect(c.buffer).toBeNull();
  });
});

describe('addCompilerScopeLevel / closeCompilerScopeLevels', () => {
  test('pushes and flushes scope closers', () => {
    const c = makeScope();
    addCompilerScopeLevel(c as never);
    addCompilerScopeLevel(c as never);
    expect(c.scopeStack).toEqual(['})', '})']);
    closeCompilerScopeLevels(c as never);
    expect(c.emitted.join('')).toContain('})});');
    expect(c.scopeStack).toEqual([]);
  });
});

describe('withCompilerScopedSyntax', () => {
  test('isolates inner scope and restores the outer stack', () => {
    const c = makeScope();
    c.scopeStack.push('OUTER');
    withCompilerScopedSyntax(c as never, () => {
      addCompilerScopeLevel(c as never);
    });
    expect(c.scopeStack).toEqual(['OUTER']);
    expect(c.emitted.join('')).toContain('})');
  });
});
