import { expect, describe, test } from 'bun:test';
import {
  Node, Value, NodeList,
  Root, Literal, AstSymbol, Group, ArrayNode, Pair, Dict,
  LookupVal, OptionalChain, Slice, If, InlineIf, For,
  Macro, Caller, Import, FromImport, FunCall, Pipe,
  Block, Super, Extends, Include, Set, Switch, Case,
  Output, Capture, TemplateData,
  UnaryOp, BinOp, In, Is, Or, And,
  Add, Sub, Mul, Div, FloorDiv, Mod, Pow, Neg, Pos,
  Compare, CompareOperand,
  CallExtension, CallExtensionAsync,
  NullishCoalesce, Concat,
} from './index.js';

describe('Node', () => {
  test('init stores lineno and colno via Value subclass', () => {
    const n = new Value(1, 2, 42);
    expect(n.lineno).toBe(1);
    expect(n.colno).toBe(2);
  });

  test('typename from extended class', () => {
    const MyNode = Node.extend('MyNode', { fields: [] });
    expect(new MyNode(0, 0).typename).toBe('MyNode');
  });

  test('iterFields iterates over field values', () => {
    const n = new (Node.extend('Test', { fields: ['a', 'b'] }))(0, 0, 'x', 'y');
    const keys = [];
    const vals = [];
    n.iterFields((v, k) => { vals.push(v); keys.push(k); });
    expect(keys).toEqual(['a', 'b']);
    expect(vals).toEqual(['x', 'y']);
  });

  test('findAll returns empty for node with no matching children', () => {
    const n = new (Node.extend('Empty', { fields: [] }))(0, 0);
    expect(n.findAll(Value)).toEqual([]);
  });
});

describe('Value', () => {
  test('has value field', () => {
    const v = new Value(0, 0, 42);
    expect(v.value).toBe(42);
  });

  test('typename is Value', () => {
    expect(new Value(0, 0).typename).toBe('Value');
  });

  test('findAll returns 0 for leaf value (it only traverses children/fields)', () => {
    const v = new Value(0, 0, 42);
    expect(v.findAll(Value)).toHaveLength(0);
  });
});

describe('NodeList', () => {
  test('init stores children', () => {
    const child = new Value(1, 1, 'a');
    const nl = new NodeList(0, 0, [child]);
    expect(nl.children).toEqual([child]);
  });

  test('init defaults children to empty array', () => {
    const nl = new NodeList(0, 0);
    expect(nl.children).toEqual([]);
  });

  test('addChild appends to children', () => {
    const nl = new NodeList(0, 0);
    const c = new Value(1, 1, 'a');
    nl.addChild(c);
    expect(nl.children).toEqual([c]);
  });

  test('typename is NodeList', () => {
    expect(new NodeList(0, 0).typename).toBe('NodeList');
  });

  test('findAll finds nodes in children', () => {
    const c1 = new Value(1, 1, 'a');
    const nl = new NodeList(0, 0, [c1]);
    expect(nl.findAll(Value)).toHaveLength(1);
  });
});

describe('Root', () => {
  test('is NodeList and has typename Root', () => {
    const r = new Root(0, 0);
    expect(r).toBeInstanceOf(NodeList);
    expect(r.typename).toBe('Root');
  });
});

describe('Literal', () => {
  test('stores various literal values', () => {
    expect(new Literal(0, 0, 42).value).toBe(42);
    expect(new Literal(0, 0, 'hello').value).toBe('hello');
    expect(new Literal(0, 0, true).value).toBe(true);
    expect(new Literal(0, 0, null).value).toBeNull();
  });
});

describe('AstSymbol', () => {
  test('stores symbol name', () => {
    const s = new AstSymbol(0, 0, 'foo');
    expect(s.value).toBe('foo');
  });
});

describe('Group', () => {
  test('is NodeList', () => {
    expect(new Group(0, 0)).toBeInstanceOf(NodeList);
  });
});

describe('ArrayNode', () => {
  test('is NodeList', () => {
    expect(new ArrayNode(0, 0)).toBeInstanceOf(NodeList);
  });
});

describe('Pair', () => {
  test('stores key and value', () => {
    const p = new Pair(0, 0, 'name', 42);
    expect(p.key).toBe('name');
    expect(p.value).toBe(42);
  });
});

describe('Dict', () => {
  test('is NodeList', () => {
    expect(new Dict(0, 0)).toBeInstanceOf(NodeList);
  });
});

describe('LookupVal', () => {
  test('stores target and val', () => {
    const t = new Literal(1, 1, 'obj');
    const v = new Literal(1, 2, 'key');
    const lv = new LookupVal(0, 0, t, v);
    expect(lv.target.value).toBe('obj');
    expect(lv.val.value).toBe('key');
  });
});

describe('OptionalChain', () => {
  test('stores target and val', () => {
    const oc = new OptionalChain(0, 0, new Literal(1, 1, 'a'), new Literal(1, 2, 'b'));
    expect(oc.target.value).toBe('a');
    expect(oc.val.value).toBe('b');
  });
});

describe('Slice', () => {
  test('stores start, stop, step', () => {
    const s = new Slice(0, 0, 1, 10, 2);
    expect(s.start).toBe(1);
    expect(s.stop).toBe(10);
    expect(s.step).toBe(2);
  });
});

describe('If', () => {
  test('stores cond, body, else_', () => {
    const i = new If(0, 0, new Literal(1, 1, true), new NodeList(2, 2), new NodeList(3, 3));
    expect(i.cond.value).toBe(true);
    expect(i.body).toBeInstanceOf(NodeList);
    expect(i.else_).toBeInstanceOf(NodeList);
  });
});

describe('InlineIf', () => {
  test('stores cond, body, else_', () => {
    const ii = new InlineIf(0, 0, new Literal(1, 1, true), new Literal(2, 2, 'a'), new Literal(3, 3, 'b'));
    expect(ii.cond.value).toBe(true);
    expect(ii.body.value).toBe('a');
    expect(ii.else_.value).toBe('b');
  });
});

describe('For', () => {
  test('stores arr, name, body, else_', () => {
    const f = new For(0, 0, new AstSymbol(1, 1, 'items'), new AstSymbol(2, 2, 'x'), new NodeList(3, 3), new NodeList(4, 4));
    expect(f.arr.value).toBe('items');
    expect(f.name.value).toBe('x');
  });
});

describe('Macro / Caller', () => {
  test('Macro stores name, args, body', () => {
    const m = new Macro(0, 0, 'myMacro', new NodeList(1, 1), new NodeList(2, 2));
    expect(m.name).toBe('myMacro');
  });

  test('Caller extends Macro', () => {
    expect(new Caller(0, 0, '', new NodeList(), new NodeList())).toBeInstanceOf(Macro);
  });
});

describe('Import', () => {
  test('stores template, target, withContext', () => {
    const im = new Import(0, 0, new Literal(1, 1, 'foo.njk'), 'bar', true);
    expect(im.template.value).toBe('foo.njk');
    expect(im.target).toBe('bar');
    expect(im.withContext).toBe(true);
  });
});

describe('FromImport', () => {
  test('stores template, names, withContext', () => {
    const fi = new FromImport(0, 0, new Literal(1, 1, 'foo.njk'), new NodeList(2, 2), true);
    expect(fi.template.value).toBe('foo.njk');
    expect(fi.names).toBeInstanceOf(NodeList);
    expect(fi.withContext).toBe(true);
  });

  test('defaults names to empty NodeList', () => {
    const fi = new FromImport(0, 0, new Literal(1, 1, 'foo.njk'), undefined, false);
    expect(fi.names).toBeInstanceOf(NodeList);
    expect(fi.names.children).toEqual([]);
  });
});

describe('FunCall / Pipe', () => {
  test('FunCall stores name and args', () => {
    const fc = new FunCall(0, 0, new AstSymbol(1, 1, 'fn'), new NodeList(2, 2));
    expect(fc.name.value).toBe('fn');
  });

  test('Pipe extends FunCall', () => {
    expect(new Pipe(0, 0, new AstSymbol(1, 1, 'f'), new NodeList())).toBeInstanceOf(FunCall);
  });
});

describe('Block', () => {
  test('stores name and body', () => {
    const b = new Block(0, 0, 'content', new NodeList(1, 1));
    expect(b.name).toBe('content');
    expect(b.body).toBeInstanceOf(NodeList);
  });
});

describe('Super', () => {
  test('stores blockName and symbol', () => {
    const s = new Super(0, 0, 'content', new AstSymbol(1, 1, 's'));
    expect(s.blockName).toBe('content');
    expect(s.symbol.value).toBe('s');
  });
});

describe('Extends', () => {
  test('stores template', () => {
    const e = new Extends(0, 0, new Literal(1, 1, 'base.njk'));
    expect(e.template.value).toBe('base.njk');
  });
});

describe('Include', () => {
  test('stores template and ignoreMissing', () => {
    const inc = new Include(0, 0, new Literal(1, 1, 'inc.njk'), true);
    expect(inc.template.value).toBe('inc.njk');
    expect(inc.ignoreMissing).toBe(true);
  });
});

describe('Set', () => {
  test('stores targets, value, operator', () => {
    const s = new Set(0, 0, new NodeList(1, 1), new Literal(2, 2, 5), '=');
    expect(s.targets).toBeInstanceOf(NodeList);
    expect(s.value.value).toBe(5);
    expect(s.operator).toBe('=');
  });
});

describe('Switch / Case', () => {
  test('Switch stores expr, cases, default', () => {
    const sw = new Switch(0, 0, new AstSymbol(1, 1, 'x'), [new Case(2, 2, new Literal(3, 3, 1), new NodeList(4, 4))], new NodeList(5, 5));
    expect(sw.expr.value).toBe('x');
    expect(sw.cases[0]).toBeInstanceOf(Case);
    expect(sw.default).toBeInstanceOf(NodeList);
  });

  test('Case stores cond and body', () => {
    const c = new Case(0, 0, new Literal(1, 1, 1), new NodeList(2, 2));
    expect(c.cond.value).toBe(1);
    expect(c.body).toBeInstanceOf(NodeList);
  });
});

describe('Output / Capture / TemplateData', () => {
  test('Output is NodeList', () => {
    expect(new Output(0, 0)).toBeInstanceOf(NodeList);
  });

  test('Capture stores body', () => {
    const c = new Capture(0, 0, new NodeList(1, 1));
    expect(c.body).toBeInstanceOf(NodeList);
  });

  test('TemplateData extends Literal', () => {
    const td = new TemplateData(0, 0, 'data');
    expect(td).toBeInstanceOf(Literal);
    expect(td.value).toBe('data');
  });
});

describe('UnaryOp / BinOp', () => {
  test('UnaryOp stores target', () => {
    const u = new UnaryOp(0, 0, new Literal(1, 1, -5));
    expect(u.target.value).toBe(-5);
  });

  test('BinOp stores left and right', () => {
    const b = new BinOp(0, 0, new Literal(1, 1, 1), new Literal(2, 2, 2));
    expect(b.left.value).toBe(1);
    expect(b.right.value).toBe(2);
  });
});

describe('Concrete BinOp types', () => {
  const binOps = [In, Is, Or, And, Add, Sub, Mul, Div, FloorDiv, Mod, Pow, NullishCoalesce, Concat];
  test.each(binOps)('%s extends BinOp', (Op) => {
    const inst = new Op(0, 0, new Literal(1, 1, 1), new Literal(2, 2, 2));
    expect(inst).toBeInstanceOf(BinOp);
    expect(inst.left.value).toBe(1);
    expect(inst.right.value).toBe(2);
  });
});

describe('Concrete UnaryOp types', () => {
  test('Neg extends UnaryOp', () => {
    const n = new Neg(0, 0, new Literal(1, 1, 5));
    expect(n).toBeInstanceOf(UnaryOp);
    expect(n.target.value).toBe(5);
  });

  test('Pos extends UnaryOp', () => {
    const p = new Pos(0, 0, new Literal(1, 1, 5));
    expect(p).toBeInstanceOf(UnaryOp);
  });
});

describe('Comparison nodes', () => {
  test('Compare stores expr and ops', () => {
    const c = new Compare(0, 0, new AstSymbol(1, 1, 'x'), [new CompareOperand(2, 2, new Literal(3, 3, 5), '==')]);
    expect(c.expr.value).toBe('x');
    expect(c.ops[0].expr.value).toBe(5);
    expect(c.ops[0].type).toBe('==');
  });
});

describe('CallExtension', () => {
  test('stores extName, prop, args, contentArgs', () => {
    const ext = { __name: 'testExt', autoescape: true };
    const ce = new CallExtension(ext, 'foo', new NodeList(0, 0), [new NodeList(0, 0)]);
    expect(ce.extName).toBe('testExt');
    expect(ce.prop).toBe('foo');
    expect(ce.args).toBeInstanceOf(NodeList);
    expect(ce.contentArgs).toHaveLength(1);
    expect(ce.autoescape).toBe(true);
  });

  test('defaults args to new NodeList', () => {
    const ce = new CallExtension({ __name: 'e' }, 'f');
    expect(ce.args).toBeInstanceOf(NodeList);
    expect(ce.args.children).toEqual([]);
    expect(ce.contentArgs).toEqual([]);
  });

  test('CallExtensionAsync extends CallExtension', () => {
    expect(new CallExtensionAsync({ __name: 'e' }, 'f')).toBeInstanceOf(CallExtension);
  });
});
