import { expect, describe, test } from 'bun:test';
import {
  node, value, literal, symbol, nodeList, root, group, array, dict, pair,
  lookupVal, optionalChain, slice, funCall, pipe, templateData,
  add, sub, mul, div, floorDiv, mod, pow, concat, nullishCoalesce,
  neg, pos, and, or, compare, compareOperand,
  if_, inlineIf, for_, block, set, macro, caller, import_, fromImport,
  extends_, include, switch_, case_, capture, is, in_, super_, callExtension, callExtensionAsync,
  isOutput,
} from '@nunjucks/nodes';
import { getType, getFields_, addChild } from '@nunjucks/nodes/traverse';
import type { Node } from '@nunjucks/nodes';

describe('Node', () => {
  test('init stores lineno and colno via Value', () => {
    const n = value(1, 2, 42);
    expect(n.lineno).toBe(1);
    expect(n.colno).toBe(2);
  });

  test('typename from node type', () => {
    const n = node(0, 0);
    expect(getType(n)).toBe('node');
  });

  test('getNodeFields returns field names', () => {
    const n = literal(0, 0, 'x');
    const fieldsResult = getFields_(n);
    expect([...fieldsResult]).toEqual(['value']);
  });
});

describe('Value', () => {
  test('has value field', () => {
    const v = value(0, 0, 42);
    expect(v.value).toBe(42);
  });

  test('typename is value', () => {
    expect(getType(value(0, 0, undefined))).toBe('value');
  });
});

describe('NodeList', () => {
  test('init stores children', () => {
    const child = value(1, 1, 'a');
    const nl = nodeList(0, 0, [child]);
    expect([...nl.children!]).toEqual([child]);
  });

  test('init defaults children to empty array', () => {
    const nl = nodeList(0, 0);
    expect([...nl.children!]).toEqual([]);
  });

  test('addChild appends to children', () => {
    const nl = nodeList(0, 0);
    const c = value(1, 1, 'a');
    const result = addChild(nl, c);
    expect([...(result as { children: unknown[] }).children!]).toEqual([c]);
  });

  test('typename is nodeList', () => {
    expect(getType(nodeList(0, 0))).toBe('nodeList');
  });
});

describe('Root', () => {
  test('has typename root', () => {
    const r = root(0, 0);
    expect(getType(r)).toBe('root');
  });
});

describe('Literal', () => {
  test('stores various literal values', () => {
    expect(literal(0, 0, 42).value).toBe(42);
    expect(literal(0, 0, 'hello').value).toBe('hello');
    expect(literal(0, 0, true).value).toBe(true);
    expect(literal(0, 0, null).value).toBeNull();
  });
});

describe('Symbol', () => {
  test('stores symbol name', () => {
    const s = symbol(0, 0, 'foo');
    expect(s.value).toBe('foo');
  });
});

describe('Group', () => {
  test('has type group', () => {
    const g = group(0, 0);
    expect(getType(g)).toBe('group');
  });
});

describe('Array', () => {
  test('has type array', () => {
    const a = array(0, 0);
    expect(getType(a)).toBe('array');
  });
});

describe('Pair', () => {
  test('stores key and value', () => {
    const p = pair(0, 0, literal(0, 0, 'name'), literal(0, 0, 42));
    expect((p.key as { value: string }).value).toBe('name');
    expect((p.value as { value: number }).value).toBe(42);
  });
});

describe('Dict', () => {
  test('has type dict', () => {
    const d = dict(0, 0);
    expect(getType(d)).toBe('dict');
  });
});

describe('LookupVal', () => {
  test('stores target and val', () => {
    const t = literal(1, 1, 'obj');
    const v = literal(1, 2, 'key');
    const lv = lookupVal(0, 0, t, v);
    expect((lv.target as { value: string }).value).toBe('obj');
    expect((lv.val as { value: string }).value).toBe('key');
  });
});

describe('OptionalChain', () => {
  test('stores target and val', () => {
    const oc = optionalChain(0, 0, literal(1, 1, 'a'), literal(1, 2, 'b'));
    expect((oc.target as { value: string }).value).toBe('a');
    expect((oc.val as { value: string }).value).toBe('b');
  });
});

describe('Slice', () => {
  test('stores start, stop, step', () => {
    const s = slice(0, 0, literal(0, 0, 1), literal(0, 0, 10), literal(0, 0, 2));
    expect((s.start as { value: number }).value).toBe(1);
    expect((s.stop as { value: number }).value).toBe(10);
    expect((s.step as { value: number }).value).toBe(2);
  });
});

describe('If', () => {
  test('stores cond, body, else_', () => {
    const i = if_(0, 0, literal(1, 1, true), nodeList(2, 2), nodeList(3, 3));
    expect((i.cond as { value: boolean }).value).toBe(true);
    expect(getType(i.body)).toBe('nodeList');
    expect(getType(i.else_)).toBe('nodeList');
  });
});

describe('InlineIf', () => {
  test('stores cond, body, else_', () => {
    const ii = inlineIf(0, 0, literal(1, 1, true), literal(2, 2, 'a'), literal(3, 3, 'b'));
    expect((ii.cond as { value: boolean }).value).toBe(true);
    expect((ii.body as unknown as { value: string }).value).toBe('a');
    expect((ii.else_ as { value: string }).value).toBe('b');
  });
});

describe('For', () => {
  test('stores arr, name, body, else_', () => {
    const f = for_(0, 0, symbol(1, 1, 'items'), 'x', nodeList(3, 3), nodeList(4, 4));
    expect((f.arr as { value: string }).value).toBe('items');
    expect(f.name).toBe('x');
  });
});

describe('Macro / Caller', () => {
  test('Macro stores name, args, body', () => {
    const m = macro(0, 0, 'myMacro', [...nodeList(1, 1).children!], nodeList(2, 2));
    expect(m.name).toBe('myMacro');
  });

  test('Caller has typename caller', () => {
    expect(getType(caller(0, 0, [...nodeList(0, 0).children!], nodeList(0, 0)))).toBe('caller');
  });
});

describe('Import', () => {
  test('stores template, target, withContext', () => {
    const im = import_(0, 0, 'foo.njk', 'bar', true);
    expect(im.template).toBe('foo.njk');
    expect(im.target).toBe('bar');
    expect(im.withContext).toBe(true);
  });
});

describe('FromImport', () => {
  test('stores template, names, withContext', () => {
    const fi = fromImport(0, 0, 'foo.njk', nodeList(2, 2), true);
    expect(fi.template).toBe('foo.njk');
    expect(getType(fi.names)).toBe('nodeList');
    expect(fi.withContext).toBe(true);
  });

  test('defaults names to empty NodeList', () => {
    const fi = fromImport(0, 0, 'foo.njk', undefined, false);
    expect(getType(fi.names)).toBe('nodeList');
    expect([...(fi.names as { children: unknown[] }).children!]).toEqual([]);
  });
});

describe('FunCall / Pipe', () => {
  test('FunCall stores name and args', () => {
    const fc = funCall(0, 0, symbol(1, 1, 'fn'), [...nodeList(2, 2).children!]);
    expect((fc.name as { value: string }).value).toBe('fn');
  });

  test('Pipe has typename pipe', () => {
    expect(getType(pipe(0, 0, symbol(1, 1, 'f'), [...nodeList(0, 0).children!]))).toBe('pipe');
  });
});

describe('Block', () => {
  test('stores name and body', () => {
    const b = block(0, 0, 'content', nodeList(1, 1));
    expect(b.name).toBe('content');
    expect(getType(b.body)).toBe('nodeList');
  });
});

describe('Super', () => {
  test('stores blockName and symbol', () => {
    const s = super_(0, 0, 'content');
    expect(s.blockName).toBe('content');
  });
});

describe('Extends', () => {
  test('stores template', () => {
    const e = extends_(0, 0, literal(1, 1, 'base.njk'));
    expect((e.template as { value: string }).value).toBe('base.njk');
  });
});

describe('Include', () => {
  test('stores template and ignoreMissing', () => {
    const inc = include(0, 0, literal(1, 1, 'inc.njk'), true);
    expect((inc.template as { value: string }).value).toBe('inc.njk');
    expect(inc.ignoreMissing).toBe(true);
  });
});

describe('Set', () => {
  test('stores targets, value, operator', () => {
    const s = set(0, 0, [...nodeList(1, 1).children!], literal(2, 2, 5), '=');
    expect(s.targets).toBeDefined();
    expect((s.value as { value: number }).value).toBe(5);
    expect(s.operator).toBe('=');
  });
});

describe('Switch / Case', () => {
  test('Switch stores expr, cases, default', () => {
    const sw = switch_(0, 0, symbol(1, 1, 'x'), [case_(2, 2, literal(3, 3, 1), nodeList(4, 4))], nodeList(5, 5));
    expect((sw.expr as { value: string }).value).toBe('x');
    expect((sw.cases as unknown[])[0]).toBeDefined();
    expect(sw.default).toBeDefined();
  });

  test('Case stores cond and body', () => {
    const c = case_(0, 0, literal(1, 1, 1), nodeList(2, 2));
    expect((c.cond as { value: number }).value).toBe(1);
    expect(c.body).toBeDefined();
  });
});

describe('Output / Capture / TemplateData', () => {
  test('Output is NodeList', () => {
    expect(isOutput(nodeList(0, 0))).toBe(false);
  });

  test('Capture stores body', () => {
    const c = capture(0, 0, nodeList(1, 1));
    expect(c.body).toBeDefined();
  });

  test('TemplateData has value', () => {
    const td = templateData(0, 0, 'data');
    expect(getType(td)).toBe('templateData');
    expect(td.value).toBe('data');
  });
});

describe('UnaryOp / BinOp', () => {
  test('Neg stores target', () => {
    const u = neg(0, 0, literal(1, 1, -5));
    expect((u.target as { value: number }).value).toBe(-5);
  });

  test('add stores left and right', () => {
    const b = add(0, 0, literal(1, 1, 1), literal(2, 2, 2));
    expect((b.left as { value: number }).value).toBe(1);
    expect((b.right as { value: number }).value).toBe(2);
  });
});

describe('Concrete BinOp types', () => {
  const binOps = [
    { create: (l: unknown, r: unknown) => in_(0, 0, l as never, r as never), name: 'in' },
    { create: (l: unknown, r: unknown) => is(0, 0, l as never, r as never), name: 'is' },
    { create: (l: unknown, r: unknown) => or(0, 0, l as never, r as never), name: 'or' },
    { create: (l: unknown, r: unknown) => and(0, 0, l as never, r as never), name: 'and' },
    { create: (l: unknown, r: unknown) => add(0, 0, l as never, r as never), name: 'add' },
    { create: (l: unknown, r: unknown) => sub(0, 0, l as never, r as never), name: 'sub' },
    { create: (l: unknown, r: unknown) => mul(0, 0, l as never, r as never), name: 'mul' },
    { create: (l: unknown, r: unknown) => div(0, 0, l as never, r as never), name: 'div' },
    { create: (l: unknown, r: unknown) => floorDiv(0, 0, l as never, r as never), name: 'floorDiv' },
    { create: (l: unknown, r: unknown) => mod(0, 0, l as never, r as never), name: 'mod' },
    { create: (l: unknown, r: unknown) => pow(0, 0, l as never, r as never), name: 'pow' },
    { create: (l: unknown, r: unknown) => nullishCoalesce(0, 0, l as never, r as never), name: 'nullishCoalesce' },
    { create: (l: unknown, r: unknown) => concat(0, 0, l as never, r as never), name: 'concat' },
  ];
  test.each(binOps)('$name has correct type', ({ create, name }) => {
    const inst = create(literal(1, 1, 1), literal(2, 2, 2));
    expect(getType(inst)).toBe(name);
    expect((inst.left as { value: number }).value).toBe(1);
    expect((inst.right as { value: number }).value).toBe(2);
  });
});

describe('Concrete UnaryOp types', () => {
  test('Neg has type neg', () => {
    const n = neg(0, 0, literal(1, 1, 5));
    expect(getType(n)).toBe('neg');
    expect((n.target as { value: number }).value).toBe(5);
  });

  test('Pos has type pos', () => {
    const p = pos(0, 0, literal(1, 1, 5));
    expect(getType(p)).toBe('pos');
  });
});

describe('Comparison nodes', () => {
  test('Compare stores expr and ops', () => {
    const c = compare(0, 0, symbol(1, 1, 'x'), [compareOperand(2, 2, literal(3, 3, 5), '==')]);
    expect((c.expr as { value: string }).value).toBe('x');
    const ops = c.ops as { expr: Node; operator: string }[];
    expect((ops[0]!.expr as unknown as { value: number }).value).toBe(5);
    expect(ops[0]!.operator).toBe('==');
  });
});

describe('CallExtension', () => {
  test('stores extName, prop, args, contentArgs', () => {
    const ext = { __name: 'testExt', autoescape: true };
    const ce = callExtension(ext, 'foo', nodeList(0, 0), [nodeList(0, 0)]);
    expect(ce.extName).toBe('testExt');
    expect(ce.prop).toBe('foo');
    expect(ce.args).toBeDefined();
    expect(ce.contentArgs).toHaveLength(1);
    expect(ce.autoescape).toBe(true);
  });

  test('defaults args to NodeList', () => {
    const ce = callExtension({ __name: 'e' }, 'f');
    expect(ce.args).toBeDefined();
    expect([...(ce.args as { children: unknown[] }).children!]).toEqual([]);
    expect([...(ce.contentArgs as unknown[])]).toEqual([]);
  });

  test('CallExtensionAsync has typename callExtensionAsync', () => {
    const ce = callExtensionAsync({ __name: 'e' }, 'f');
    expect(getType(ce)).toBe('callExtensionAsync');
  });
});
