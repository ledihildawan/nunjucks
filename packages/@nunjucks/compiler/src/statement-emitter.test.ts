import { describe, test, expect } from 'bun:test';
import { emitFuncBegin, emitFuncEnd, addScopeLevel, closeScopeLevels, withScopedSyntax } from './statement-emitter.ts';
import { literal } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';

const makeScope = () => {
  const emitted: string[] = [];
  const scope = {
    emitted,
    buffer: 'output',
    scopeStack: [] as string[],
    emitLine: (s: string) => { emitted.push(`${s}\n`); },
    closeScopeLevels: () => {
      if (scope.scopeStack.length > 0) {
        scope.emitLine(`${scope.scopeStack.join('')};`);
        scope.scopeStack = [];
      }
    },
  };
  return scope;
};

describe('emitFuncBegin', () => {
  test('root emits an async generator header with no output buffer', () => {
    const c = makeScope();
    emitFuncBegin(c as never, literal(loc({ lineno: 2, colno: 4 }), ''), 'root');
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
    emitFuncBegin(c as never, literal(loc({ lineno: 2, colno: 4 }), ''), 'b_content');
    expect(c.buffer).toBeNull();
    const joined = c.emitted.join('');
    expect(joined).toContain('async function* b_content(env, context, frame, runtime) {');
    expect(joined).not.toContain('let output = "";');
  });
});

describe('emitFuncEnd', () => {
  test('emits return + catch + closing brace and nulls the buffer', () => {
    const c = makeScope();
    c.scopeStack.push('})');
    emitFuncEnd(c as never);
    const joined = c.emitted.join('');
    expect(joined).toContain('return output;');
    expect(joined).toContain('} catch (e) {');
    expect(joined).toContain('throw runtime.handleError');
    expect(c.buffer).toBeNull();
  });

  test('skips return when noReturn is set', () => {
    const c = makeScope();
    emitFuncEnd(c as never, true);
    expect(c.emitted.join('')).not.toContain('return output;');
  });
});

describe('addScopeLevel / closeScopeLevels', () => {
  test('pushes and flushes scope closers', () => {
    const c = makeScope();
    addScopeLevel(c as never);
    addScopeLevel(c as never);
    expect(c.scopeStack).toEqual(['})', '})']);
    closeScopeLevels(c as never);
    expect(c.emitted.join('')).toContain('})});');
    expect(c.scopeStack).toEqual([]);
  });
});

describe('withScopedSyntax', () => {
  test('isolates inner scope and restores the outer stack', () => {
    const c = makeScope();
    c.scopeStack.push('OUTER');
    withScopedSyntax(c as never, () => {
      addScopeLevel(c as never);
    });
    expect(c.scopeStack).toEqual(['OUTER']);
    expect(c.emitted.join('')).toContain('})');
  });
});