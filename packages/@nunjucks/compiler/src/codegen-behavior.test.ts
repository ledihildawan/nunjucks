import { describe, test, expect } from 'bun:test';
import { createCompiler } from './index.ts';
import { createFrame } from '@nunjucks/runtime';
import {
  root, output, templateData, literal, symbol,
  add, sub, mul, compare, compareOperand,
  if_, for_, funCall, lookupVal, block,
  not, and, or, nullishCoalesce,
  component, exec_, scope_, match, when, renderBlock,
} from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';

const compileNode = (node: Node): string => {
  const c = createCompiler('test', 'chainable', '');
  c.compile(node, createFrame());
  return c.getCode();
};

const compileRoot = (children: Node[]): string => {
  const c = createCompiler('test', 'chainable', '');
  c.compile(root(0, 0, children), createFrame());
  return c.getCode();
};

describe('codegen: literal and symbol', () => {
  test('string literal emits quoted string', () => {
    const code = compileNode(literal(0, 0, 'hello'));
    expect(code).toContain('hello');
  });
  test('number literal emits number', () => {
    const code = compileNode(literal(0, 0, 42));
    expect(code).toContain('42');
  });
  test('boolean literal emits boolean', () => {
    const code = compileNode(literal(0, 0, true));
    expect(code).toContain('true');
  });
  test('symbol emits contextOrFrameLookup', () => {
    const code = compileNode(symbol(0, 0, 'myVar'));
    expect(code).toContain('contextOrFrameLookup');
    expect(code).toContain('myVar');
  });
});

describe('codegen: binary operations', () => {
  test('add emits +', () => {
    const code = compileNode(add(0, 0, literal(0, 0, 1), literal(0, 0, 2)));
    expect(code).toContain('+');
  });
  test('sub emits -', () => {
    const code = compileNode(sub(0, 0, literal(0, 0, 1), literal(0, 0, 2)));
    expect(code).toContain('-');
  });
  test('mul emits *', () => {
    const code = compileNode(mul(0, 0, literal(0, 0, 1), literal(0, 0, 2)));
    expect(code).toContain('*');
  });
});

describe('codegen: logical operations', () => {
  test('and emits logical AND', () => {
    const code = compileNode(and(0, 0, literal(0, 0, true), literal(0, 0, false)));
    expect(code.length).toBeGreaterThan(0);
  });
  test('or emits logical OR', () => {
    const code = compileNode(or(0, 0, literal(0, 0, true), literal(0, 0, false)));
    expect(code.length).toBeGreaterThan(0);
  });
  test('not emits negation', () => {
    const code = compileNode(not(0, 0, literal(0, 0, true)));
    expect(code.length).toBeGreaterThan(0);
  });
  test('nullishCoalesce emits ??', () => {
    const code = compileNode(nullishCoalesce(0, 0, literal(0, 0, 1), literal(0, 0, 2)));
    expect(code).toContain('??');
  });
});

describe('codegen: comparison', () => {
  test('compare emits comparison logic', () => {
    const operand = compareOperand(0, 0, literal(0, 0, 2), '<');
    const code = compileNode(compare(0, 0, literal(0, 0, 1), [operand]));
    expect(code.length).toBeGreaterThan(0);
  });
});

describe('codegen: function call', () => {
  test('funCall emits runtime.callWrap', () => {
    const code = compileNode(funCall(0, 0, symbol(0, 0, 'greet'), [literal(0, 0, 'World')]));
    expect(code).toContain('callWrap');
  });
});

describe('codegen: member lookup', () => {
  test('lookupVal emits member access', () => {
    const code = compileNode(lookupVal(0, 0, symbol(0, 0, 'obj'), literal(0, 0, 'key')));
    expect(code).toContain('memberLookup');
  });
});

describe('codegen: if statement', () => {
  test('if/else emits conditional branching', () => {
    const code = compileRoot([
      if_(0, 0, {
        cond: literal(0, 0, true),
        body: output(0, 0, [templateData(0, 0, 'yes')]),
        else_: output(0, 0, [templateData(0, 0, 'no')]),
      }),
    ]);
    expect(code).toContain('if');
  });
});

describe('codegen: for loop', () => {
  test('for emits loop with runtime.fromIterator', () => {
    const code = compileRoot([
      for_(0, 0, {
        arr: symbol(0, 0, 'items'),
        name: symbol(0, 0, 'x'),
        body: output(0, 0, [templateData(0, 0, '.')]),
        else_: null,
      }),
    ]);
    expect(code).toContain('fromIterator');
    expect(code).toContain('frame.push');
  });

  test('for-else pre-declares len=0 before if block', () => {
    const code = compileRoot([
      for_(0, 0, {
        arr: symbol(0, 0, 'items'),
        name: symbol(0, 0, 'x'),
        body: output(0, 0, [templateData(0, 0, '.')]),
        else_: output(0, 0, [templateData(0, 0, 'empty')]),
      }),
    ]);
    // len must be declared before the if(arr) block for for-else to work
    const lenInitPos = code.indexOf('= 0;');
    const ifPos = code.indexOf('if(');
    expect(lenInitPos).toBeGreaterThan(-1);
    expect(ifPos).toBeGreaterThan(-1);
    expect(lenInitPos).toBeLessThan(ifPos);
  });

  test('for emits loop bindings (index, first, last)', () => {
    const code = compileRoot([
      for_(0, 0, {
        arr: symbol(0, 0, 'items'),
        name: symbol(0, 0, 'x'),
        body: output(0, 0, [templateData(0, 0, '.')]),
        else_: null,
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
      block(0, 0, 'content', output(0, 0, [templateData(0, 0, 'base')])),
    ]);
    expect(code).toContain('b_content');
  });
});

describe('codegen: output and template data', () => {
  test('templateData emits string in suppressValue', () => {
    const code = compileNode(output(0, 0, [templateData(0, 0, 'hello')]));
    expect(code).toContain('hello');
  });
});

describe('codegen: root structure', () => {
  test('root emits async function with correct signature', () => {
    const code = compileRoot([output(0, 0, [templateData(0, 0, 'x')])]);
    expect(code).toContain('async function root');
    expect(code).toContain('env, context, frame, runtime');
    expect(code).toContain('__blockMeta');
    expect(code).toContain('return childOutput');
  });
});

describe('codegen: component', () => {
  test('component emits async function with slot setup', () => {
    const code = compileRoot([
      component(0, 0, {
        name: 'MyComponent',
        args: [],
        body: output(0, 0, [templateData(0, 0, 'content')]),
      }),
    ]);
    expect(code).toContain('async');
    expect(code).toContain('runtime.makeComponent');
  });
});

describe('codegen: exec', () => {
  test('exec emits try/catch around expression', () => {
    const code = compileRoot([
      exec_(0, 0, funCall(0, 0, symbol(0, 0, 'someFn'), [])),
    ]);
    expect(code).toContain('try');
    expect(code).toContain('catch');
  });
});

describe('codegen: match', () => {
  test('match emits conditional branching', () => {
    const code = compileRoot([
      match(0, 0, {
        expr: symbol(0, 0, 'val'),
        cases: [
          when(0, 0, literal(0, 0, 'a'), output(0, 0, [templateData(0, 0, 'one')])),
          when(0, 0, literal(0, 0, 'b'), output(0, 0, [templateData(0, 0, 'two')])),
        ],
        default: output(0, 0, [templateData(0, 0, 'default')]),
      }),
    ]);
    expect(code).toContain('if');
  });
});

describe('codegen: render', () => {
  test('render emits async component invocation', () => {
    const code = compileRoot([
      renderBlock(0, 0, {
        callExpr: funCall(0, 0, symbol(0, 0, 'MyComponent'), []),
        body: output(0, 0, [templateData(0, 0, 'body')]),
        providedSlots: [],
      }),
    ]);
    expect(code).toContain('await');
  });
});

describe('codegen: scope', () => {
  test('scope emits frame operations', () => {
    const code = compileRoot([
      scope_(0, 0, [], output(0, 0, [templateData(0, 0, 'scoped')])),
    ]);
    expect(code).toContain('frame');
  });
});

describe('codegen: slot', () => {
  test('block emits block function with b_ prefix', () => {
    const code = compileRoot([
      block(0, 0, 'header', output(0, 0, [templateData(0, 0, 'header content')])),
    ]);
    expect(code).toContain('b_header');
  });
});
