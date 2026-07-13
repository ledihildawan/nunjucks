import { expect, describe, test } from 'bun:test';
import { nodes } from './index.js';

describe('Node', () => {
  test('init stores lineno and colno via Value', () => {
    const n = nodes.value(1, 2, 42);
    expect(n.lineno).toBe(1);
    expect(n.colno).toBe(2);
  });

  test('typename from node type', () => {
    const n = nodes.node(0, 0);
    expect(nodes.getNodeTypeName(n)).toBe('node');
  });

  test('getNodeFields returns field names', () => {
    const n = nodes.literal(0, 0, 'x');
    const fields = nodes.getNodeFields(n);
    expect(fields).toEqual(['value']);
  });
});

describe('Value', () => {
  test('has value field', () => {
    const v = nodes.value(0, 0, 42);
    expect(v.value).toBe(42);
  });

  test('typename is value', () => {
    expect(nodes.getNodeTypeName(nodes.value(0, 0))).toBe('value');
  });
});

describe('NodeList', () => {
  test('init stores children', () => {
    const child = nodes.value(1, 1, 'a');
    const nl = nodes.nodeList(0, 0, [child]);
    expect(nl.children).toEqual([child]);
  });

  test('init defaults children to empty array', () => {
    const nl = nodes.nodeList(0, 0);
    expect(nl.children).toEqual([]);
  });

  test('addChild appends to children', () => {
    const nl = nodes.nodeList(0, 0);
    const c = nodes.value(1, 1, 'a');
    const result = nodes.addChild(nl, c);
    expect(result.children).toEqual([c]);
  });

  test('typename is nodeList', () => {
    expect(nodes.getNodeTypeName(nodes.nodeList(0, 0))).toBe('nodeList');
  });
});

describe('Root', () => {
  test('has typename root', () => {
    const r = nodes.root(0, 0);
    expect(nodes.getNodeTypeName(r)).toBe('root');
  });
});

describe('Literal', () => {
  test('stores various literal values', () => {
    expect(nodes.literal(0, 0, 42).value).toBe(42);
    expect(nodes.literal(0, 0, 'hello').value).toBe('hello');
    expect(nodes.literal(0, 0, true).value).toBe(true);
    expect(nodes.literal(0, 0, null).value).toBeNull();
  });
});

describe('Symbol', () => {
  test('stores symbol name', () => {
    const s = nodes.symbol(0, 0, 'foo');
    expect(s.value).toBe('foo');
  });
});

describe('Group', () => {
  test('has type group', () => {
    const g = nodes.group(0, 0);
    expect(nodes.getNodeTypeName(g)).toBe('group');
  });
});

describe('Array', () => {
  test('has type array', () => {
    const a = nodes.array(0, 0);
    expect(nodes.getNodeTypeName(a)).toBe('array');
  });
});

describe('Pair', () => {
  test('stores key and value', () => {
    const p = nodes.pair(0, 0, 'name', 42);
    expect(p.key).toBe('name');
    expect(p.value).toBe(42);
  });
});

describe('Dict', () => {
  test('has type dict', () => {
    const d = nodes.dict(0, 0);
    expect(nodes.getNodeTypeName(d)).toBe('dict');
  });
});

describe('LookupVal', () => {
  test('stores target and val', () => {
    const t = nodes.literal(1, 1, 'obj');
    const v = nodes.literal(1, 2, 'key');
    const lv = nodes.lookupVal(0, 0, t, v);
    expect(lv.target.value).toBe('obj');
    expect(lv.val.value).toBe('key');
  });
});

describe('OptionalChain', () => {
  test('stores target and val', () => {
    const oc = nodes.optionalChain(0, 0, nodes.literal(1, 1, 'a'), nodes.literal(1, 2, 'b'));
    expect(oc.target.value).toBe('a');
    expect(oc.val.value).toBe('b');
  });
});

describe('Slice', () => {
  test('stores start, stop, step', () => {
    const s = nodes.slice(0, 0, 1, 10, 2);
    expect(s.start).toBe(1);
    expect(s.stop).toBe(10);
    expect(s.step).toBe(2);
  });
});

describe('If', () => {
  test('stores cond, body, else_', () => {
    const i = nodes.if(0, 0, nodes.literal(1, 1, true), nodes.nodeList(2, 2), nodes.nodeList(3, 3));
    expect(i.cond.value).toBe(true);
    expect(nodes.getNodeTypeName(i.body)).toBe('nodeList');
    expect(nodes.getNodeTypeName(i.else_)).toBe('nodeList');
  });
});

describe('InlineIf', () => {
  test('stores cond, body, else_', () => {
    const ii = nodes.inlineIf(0, 0, nodes.literal(1, 1, true), nodes.literal(2, 2, 'a'), nodes.literal(3, 3, 'b'));
    expect(ii.cond.value).toBe(true);
    expect(ii.body.value).toBe('a');
    expect(ii.else_.value).toBe('b');
  });
});

describe('For', () => {
  test('stores arr, name, body, else_', () => {
    const f = nodes.for(0, 0, nodes.symbol(1, 1, 'items'), nodes.symbol(2, 2, 'x'), nodes.nodeList(3, 3), nodes.nodeList(4, 4));
    expect(f.arr.value).toBe('items');
    expect(f.name.value).toBe('x');
  });
});

describe('Macro / Caller', () => {
  test('Macro stores name, args, body', () => {
    const m = nodes.macro(0, 0, 'myMacro', nodes.nodeList(1, 1), nodes.nodeList(2, 2));
    expect(m.name).toBe('myMacro');
  });

  test('Caller has typename caller', () => {
    expect(nodes.getNodeTypeName(nodes.caller(0, 0, nodes.nodeList(), nodes.nodeList()))).toBe('caller');
  });
});

describe('Import', () => {
  test('stores template, target, withContext', () => {
    const im = nodes.import(0, 0, nodes.literal(1, 1, 'foo.njk'), 'bar', true);
    expect(im.template.value).toBe('foo.njk');
    expect(im.target).toBe('bar');
    expect(im.withContext).toBe(true);
  });
});

describe('FromImport', () => {
  test('stores template, names, withContext', () => {
    const fi = nodes.fromImport(0, 0, nodes.literal(1, 1, 'foo.njk'), nodes.nodeList(2, 2), true);
    expect(fi.template.value).toBe('foo.njk');
    expect(nodes.getNodeTypeName(fi.names)).toBe('nodeList');
    expect(fi.withContext).toBe(true);
  });

  test('defaults names to empty NodeList', () => {
    const fi = nodes.fromImport(0, 0, nodes.literal(1, 1, 'foo.njk'), undefined, false);
    expect(nodes.getNodeTypeName(fi.names)).toBe('nodeList');
    expect(fi.names.children).toEqual([]);
  });
});

describe('FunCall / Pipe', () => {
  test('FunCall stores name and args', () => {
    const fc = nodes.funCall(0, 0, nodes.symbol(1, 1, 'fn'), nodes.nodeList(2, 2));
    expect(fc.name.value).toBe('fn');
  });

  test('Pipe has typename pipe', () => {
    expect(nodes.getNodeTypeName(nodes.pipe(0, 0, nodes.symbol(1, 1, 'f'), nodes.nodeList()))).toBe('pipe');
  });
});

describe('Block', () => {
  test('stores name and body', () => {
    const b = nodes.block(0, 0, 'content', nodes.nodeList(1, 1));
    expect(b.name).toBe('content');
    expect(nodes.getNodeTypeName(b.body)).toBe('nodeList');
  });
});

describe('Super', () => {
  test('stores blockName and symbol', () => {
    const s = nodes.super(0, 0, 'content');
    expect(s.blockName).toBe('content');
  });
});

describe('Extends', () => {
  test('stores template', () => {
    const e = nodes.extends(0, 0, nodes.literal(1, 1, 'base.njk'));
    expect(e.template.value).toBe('base.njk');
  });
});

describe('Include', () => {
  test('stores template and ignoreMissing', () => {
    const inc = nodes.include(0, 0, nodes.literal(1, 1, 'inc.njk'), true);
    expect(inc.template.value).toBe('inc.njk');
    expect(inc.ignoreMissing).toBe(true);
  });
});

describe('Set', () => {
  test('stores targets, value, operator', () => {
    const s = nodes.set(0, 0, nodes.nodeList(1, 1), nodes.literal(2, 2, 5), '=');
    expect(s.targets).toBeDefined();
    expect(s.value.value).toBe(5);
    expect(s.operator).toBe('=');
  });
});

describe('Switch / Case', () => {
  test('Switch stores expr, cases, default', () => {
    const sw = nodes.switch(0, 0, nodes.symbol(1, 1, 'x'), [nodes.case(2, 2, nodes.literal(3, 3, 1), nodes.nodeList(4, 4))], nodes.nodeList(5, 5));
    expect(sw.expr.value).toBe('x');
    expect(sw.cases[0]).toBeDefined();
    expect(sw.default).toBeDefined();
  });

  test('Case stores cond and body', () => {
    const c = nodes.case(0, 0, nodes.literal(1, 1, 1), nodes.nodeList(2, 2));
    expect(c.cond.value).toBe(1);
    expect(c.body).toBeDefined();
  });
});

describe('Output / Capture / TemplateData', () => {
  test('Output is NodeList', () => {
    expect(nodes.isOutput(nodes.output(0, 0))).toBe(true);
  });

  test('Capture stores body', () => {
    const c = nodes.capture(0, 0, nodes.nodeList(1, 1));
    expect(c.body).toBeDefined();
  });

  test('TemplateData has value', () => {
    const td = nodes.templateData(0, 0, 'data');
    expect(nodes.getNodeTypeName(td)).toBe('templateData');
    expect(td.value).toBe('data');
  });
});

describe('UnaryOp / BinOp', () => {
  test('Neg stores target', () => {
    const u = nodes.neg(0, 0, nodes.literal(1, 1, -5));
    expect(u.target.value).toBe(-5);
  });

  test('add stores left and right', () => {
    const b = nodes.add(0, 0, nodes.literal(1, 1, 1), nodes.literal(2, 2, 2));
    expect(b.left.value).toBe(1);
    expect(b.right.value).toBe(2);
  });
});

describe('Concrete BinOp types', () => {
  const binOps = [
    { create: (l, r) => nodes.in(0, 0, l, r), name: 'in' },
    { create: (l, r) => nodes.is(0, 0, l, r), name: 'is' },
    { create: (l, r) => nodes.or(0, 0, l, r), name: 'or' },
    { create: (l, r) => nodes.and(0, 0, l, r), name: 'and' },
    { create: (l, r) => nodes.add(0, 0, l, r), name: 'add' },
    { create: (l, r) => nodes.sub(0, 0, l, r), name: 'sub' },
    { create: (l, r) => nodes.mul(0, 0, l, r), name: 'mul' },
    { create: (l, r) => nodes.div(0, 0, l, r), name: 'div' },
    { create: (l, r) => nodes.floorDiv(0, 0, l, r), name: 'floorDiv' },
    { create: (l, r) => nodes.mod(0, 0, l, r), name: 'mod' },
    { create: (l, r) => nodes.pow(0, 0, l, r), name: 'pow' },
    { create: (l, r) => nodes.nullishCoalesce(0, 0, l, r), name: 'nullishCoalesce' },
    { create: (l, r) => nodes.concat(0, 0, l, r), name: 'concat' },
  ];
  test.each(binOps)('$name has correct type', ({ create, name }) => {
    const inst = create(nodes.literal(1, 1, 1), nodes.literal(2, 2, 2));
    expect(nodes.getNodeTypeName(inst)).toBe(name);
    expect(inst.left.value).toBe(1);
    expect(inst.right.value).toBe(2);
  });
});

describe('Concrete UnaryOp types', () => {
  test('Neg has type neg', () => {
    const n = nodes.neg(0, 0, nodes.literal(1, 1, 5));
    expect(nodes.getNodeTypeName(n)).toBe('neg');
    expect(n.target.value).toBe(5);
  });

  test('Pos has type pos', () => {
    const p = nodes.pos(0, 0, nodes.literal(1, 1, 5));
    expect(nodes.getNodeTypeName(p)).toBe('pos');
  });
});

describe('Comparison nodes', () => {
  test('Compare stores expr and ops', () => {
    const c = nodes.compare(0, 0, nodes.symbol(1, 1, 'x'), [nodes.compareOperand(2, 2, nodes.literal(3, 3, 5), '==')]);
    expect(c.expr.value).toBe('x');
    expect(c.ops[0].expr.value).toBe(5);
    expect(c.ops[0].operator).toBe('==');
  });
});

describe('CallExtension', () => {
  test('stores extName, prop, args, contentArgs', () => {
    const ext = { __name: 'testExt', autoescape: true };
    const ce = nodes.callExtension(ext, 'foo', nodes.nodeList(0, 0), [nodes.nodeList(0, 0)]);
    expect(ce.extName).toBe('testExt');
    expect(ce.prop).toBe('foo');
    expect(ce.args).toBeDefined();
    expect(ce.contentArgs).toHaveLength(1);
    expect(ce.autoescape).toBe(true);
  });

  test('defaults args to NodeList', () => {
    const ce = nodes.callExtension({ __name: 'e' }, 'f');
    expect(ce.args).toBeDefined();
    expect(ce.args.children).toEqual([]);
    expect(ce.contentArgs).toEqual([]);
  });

  test('CallExtensionAsync has typename callExtensionAsync', () => {
    const ce = nodes.callExtensionAsync({ __name: 'e' }, 'f');
    expect(nodes.isCallExtensionAsync(ce)).toBe(true);
  });
});
