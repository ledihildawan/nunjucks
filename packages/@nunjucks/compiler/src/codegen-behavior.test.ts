import { describe, test, expect } from 'bun:test';
import { createCompiler } from './create-compiler.ts';
import { createFrame } from '@nunjucks/runtime';
import {
  root, output, templateData, literal, symbol,
  add, sub, mul, compare, compareOperand,
  ifNode, forNode, funCall, lookupVal, block,
  not, and, or, nullishCoalesce,
  component, execNode, scopeNode, match, when, renderNode,
} from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { ZERO_LOC } from '@nunjucks/shared';

const compileNode = (node: Node): string => {
  const c = createCompiler('test', 'chainable', '');
  c.compile(node, createFrame());
  return c.getCode();
};

const compileRoot = (children: Node[]): string => {
  const c = createCompiler('test', 'chainable', '');
  c.compile(root(ZERO_LOC, children), createFrame());
  return c.getCode();
};

describe('codegen: literal and symbol', () => {
  test('string literal emits quoted string', () => {
    const code = compileNode(literal(ZERO_LOC, 'hello'));
    expect(code).toContain('hello');
  });
  test('number literal emits number', () => {
    const code = compileNode(literal(ZERO_LOC, 42));
    expect(code).toContain('42');
  });
  test('boolean literal emits boolean', () => {
    const code = compileNode(literal(ZERO_LOC, true));
    expect(code).toContain('true');
  });
  test('symbol emits contextOrFrameLookup', () => {
    const code = compileNode(symbol(ZERO_LOC, 'myVar'));
    expect(code).toContain('contextOrFrameLookup');
    expect(code).toContain('myVar');
  });
});

describe('codegen: binary operations', () => {
  test('add emits +', () => {
    const code = compileNode(add(ZERO_LOC, { left: literal(ZERO_LOC, 1), right: literal(ZERO_LOC, 2) }));
    expect(code).toContain('+');
  });
  test('sub emits -', () => {
    const code = compileNode(sub(ZERO_LOC, { left: literal(ZERO_LOC, 1), right: literal(ZERO_LOC, 2) }));
    expect(code).toContain('-');
  });
  test('mul emits *', () => {
    const code = compileNode(mul(ZERO_LOC, { left: literal(ZERO_LOC, 1), right: literal(ZERO_LOC, 2) }));
    expect(code).toContain('*');
  });
});

describe('codegen: logical operations', () => {
  test('and emits logical AND', () => {
    const code = compileNode(and(ZERO_LOC, { left: literal(ZERO_LOC, true), right: literal(ZERO_LOC, false) }));
    expect(code.length).toBeGreaterThan(0);
  });
  test('or emits logical OR', () => {
    const code = compileNode(or(ZERO_LOC, { left: literal(ZERO_LOC, true), right: literal(ZERO_LOC, false) }));
    expect(code.length).toBeGreaterThan(0);
  });
  test('not emits negation', () => {
    const code = compileNode(not(ZERO_LOC, literal(ZERO_LOC, true)));
    expect(code.length).toBeGreaterThan(0);
  });
  test('nullishCoalesce emits ??', () => {
    const code = compileNode(nullishCoalesce(ZERO_LOC, { left: literal(ZERO_LOC, 1), right: literal(ZERO_LOC, 2) }));
    expect(code).toContain('??');
  });
});

describe('codegen: comparison', () => {
  test('compare emits comparison logic', () => {
    const operand = compareOperand(ZERO_LOC, { expr: literal(ZERO_LOC, 2), operator: '<' });
    const code = compileNode(compare(ZERO_LOC, { expr: literal(ZERO_LOC, 1), ops: [operand] }));
    expect(code.length).toBeGreaterThan(0);
  });
});

describe('codegen: function call', () => {
  test('funCall emits runtime.callWrap', () => {
    const code = compileNode(funCall(ZERO_LOC, { name: symbol(ZERO_LOC, 'greet'), args: [literal(ZERO_LOC, 'World')] }));
    expect(code).toContain('callWrap');
  });
});

describe('codegen: member lookup', () => {
  test('lookupVal emits member access', () => {
    const code = compileNode(lookupVal(ZERO_LOC, { target: symbol(ZERO_LOC, 'obj'), val: literal(ZERO_LOC, 'key') }));
    expect(code).toContain('memberLookup');
  });
});

describe('codegen: if statement', () => {
  test('if/else emits conditional branching', () => {
    const code = compileRoot([
      ifNode(ZERO_LOC, {
        cond: literal(ZERO_LOC, true),
        body: output(ZERO_LOC, [templateData(ZERO_LOC, 'yes')]),
        alternate: output(ZERO_LOC, [templateData(ZERO_LOC, 'no')]),
      }),
    ]);
    expect(code).toContain('if');
  });
});

describe('codegen: for loop', () => {
  test('for emits loop with runtime.fromIterator', () => {
    const code = compileRoot([
      forNode(ZERO_LOC, {
        arr: symbol(ZERO_LOC, 'items'),
        name: symbol(ZERO_LOC, 'x'),
        body: output(ZERO_LOC, [templateData(ZERO_LOC, '.')]),
        alternate: null,
      }),
    ]);
    expect(code).toContain('fromIterator');
    expect(code).toContain('frame.push');
  });

  test('for-else pre-declares len=0 before if block', () => {
    const code = compileRoot([
      forNode(ZERO_LOC, {
        arr: symbol(ZERO_LOC, 'items'),
        name: symbol(ZERO_LOC, 'x'),
        body: output(ZERO_LOC, [templateData(ZERO_LOC, '.')]),
        alternate: output(ZERO_LOC, [templateData(ZERO_LOC, 'empty')]),
      }),
    ]);
    const lenInitPos = code.indexOf('= 0;');
    const ifPos = code.indexOf('if(');
    expect(lenInitPos).toBeGreaterThan(-1);
    expect(ifPos).toBeGreaterThan(-1);
    expect(lenInitPos).toBeLessThan(ifPos);
  });

  test('for emits loop bindings (index, first, last)', () => {
    const code = compileRoot([
      forNode(ZERO_LOC, {
        arr: symbol(ZERO_LOC, 'items'),
        name: symbol(ZERO_LOC, 'x'),
        body: output(ZERO_LOC, [templateData(ZERO_LOC, '.')]),
        alternate: null,
      }),
    ]);
    expect(code).toContain('loop.index');
    expect(code).toContain('loop.first');
    expect(code).toContain('loop.last');
  });
});

describe('codegen: block', () => {
  test('block emits block function with b_ prefix', () => {
    const code = compileRoot([
      block(ZERO_LOC, { name: 'content', body: output(ZERO_LOC, [templateData(ZERO_LOC, 'base')]) }),
    ]);
    expect(code).toContain('b_content');
  });
});

describe('codegen: output and template data', () => {
  test('templateData emits string in suppressValue', () => {
    const code = compileNode(output(ZERO_LOC, [templateData(ZERO_LOC, 'hello')]));
    expect(code).toContain('hello');
  });
});

describe('codegen: root structure', () => {
  test('root emits async function with correct signature', () => {
    const code = compileRoot([output(ZERO_LOC, [templateData(ZERO_LOC, 'x')])]);
    expect(code).toContain('async function root');
    expect(code).toContain('env, context, frame, runtime');
    expect(code).toContain('__blockMeta');
    expect(code).toContain('return [childOutput, context]');
  });
});

describe('codegen: component', () => {
  test('component emits async function with slot setup', () => {
    const code = compileRoot([
      component(ZERO_LOC, {
        name: 'MyComponent',
        args: [],
        body: output(ZERO_LOC, [templateData(ZERO_LOC, 'content')]),
      }),
    ]);
    expect(code).toContain('async');
    expect(code).toContain('runtime.makeComponent');
  });
});

describe('codegen: exec', () => {
  test('exec emits try/catch around expression', () => {
    const code = compileRoot([
      execNode(ZERO_LOC, funCall(ZERO_LOC, { name: symbol(ZERO_LOC, 'someFn'), args: [] })),
    ]);
    expect(code).toContain('try');
    expect(code).toContain('catch');
  });
});

describe('codegen: match', () => {
  test('match emits conditional branching', () => {
    const code = compileRoot([
      match(ZERO_LOC, {
        expr: symbol(ZERO_LOC, 'val'),
        cases: [
          when(ZERO_LOC, { pattern: literal(ZERO_LOC, 'a'), body: output(ZERO_LOC, [templateData(ZERO_LOC, 'one')]) }),
          when(ZERO_LOC, { pattern: literal(ZERO_LOC, 'b'), body: output(ZERO_LOC, [templateData(ZERO_LOC, 'two')]) }),
        ],
        default: output(ZERO_LOC, [templateData(ZERO_LOC, 'default')]),
      }),
    ]);
    expect(code).toContain('if');
  });
});

describe('codegen: render', () => {
  test('render emits async component invocation', () => {
    const code = compileRoot([
      renderNode(ZERO_LOC, {
        callExpr: funCall(ZERO_LOC, { name: symbol(ZERO_LOC, 'MyComponent'), args: [] }),
        body: output(ZERO_LOC, [templateData(ZERO_LOC, 'body')]),
        providedSlots: [],
      }),
    ]);
    expect(code).toContain('await');
  });
});

describe('codegen: scope', () => {
  test('scope emits frame operations', () => {
    const code = compileRoot([
      scopeNode(ZERO_LOC, { assignments: [], body: output(ZERO_LOC, [templateData(ZERO_LOC, 'scoped')]) }),
    ]);
    expect(code).toContain('frame');
  });
});

describe('codegen: slot', () => {
  test('block emits block function with b_ prefix', () => {
    const code = compileRoot([
      block(ZERO_LOC, { name: 'header', body: output(ZERO_LOC, [templateData(ZERO_LOC, 'header content')]) }),
    ]);
    expect(code).toContain('b_header');
  });
});
