import { nodes } from '../../nodes/index.js';
import { compileDestructuring } from './pattern.js';

const emitLoopBindings = (ctx, arr, i, len) => {
  const bindings = [
    {name: 'index', val: `${i} + 1`},
    {name: 'index0', val: i},
    {name: 'revindex', val: `${len} - ${i}`},
    {name: 'revindex0', val: `${len} - ${i} - 1`},
    {name: 'first', val: `${i} === 0`},
    {name: 'last', val: `${i} === ${len} - 1`},
    {name: 'length', val: len},
  ];

  bindings.forEach((b) => {
    ctx._emitLine(`frame.set("loop.${b.name}", ${b.val});`);
  });
};

const isArrayBinding = (n) =>
  nodes.isArray(n) ||
  nodes.isArrayPattern(n) ||
  nodes.isObjectPattern(n);

const isFlatArrayBinding = (n) => nodes.isArray(n);

export const compileFor = (ctx, node, frame) => {
  const i = ctx._tmpid();
  const len = ctx._tmpid();
  const arr = ctx._tmpid();
  frame = frame.push();

  ctx._emitLine('frame = frame.push();');

  ctx._emit(`let ${arr} = `);
  ctx._compileExpression(node.arr, frame);
  ctx._emitLine(';');

  ctx._emit(`if(${arr}) {`);
  ctx._emitLine(arr + ' = runtime.fromIterator(' + arr + ');');

  if (isArrayBinding(node.name)) {
    ctx._emitLine(`let ${i};`);

    ctx._emitLine(`if(Array.isArray(${arr})) {`);
    ctx._emitLine(`let ${len} = ${arr}.length;`);
    ctx._emitLine(`for(${i}=0; ${i} < ${arr}.length; ${i}++) {`);

    const itemId = ctx._tmpid();
    ctx._emitLine(`let ${itemId} = ${arr}[${i}];`);

    if (isFlatArrayBinding(node.name)) {
      node.name.children.forEach((child, u) => {
        const tid = ctx._tmpid();
        ctx._emitLine(`let ${tid} = ${itemId}[${u}];`);
        ctx._emitLine(`frame.set("${child.value}", ${tid});`);
        frame.set(child.value, tid);
      });
    } else {
      compileDestructuring(ctx, frame, node.name, itemId);
    }

    emitLoopBindings(ctx, arr, i, len);
    ctx._withScopedSyntax(() => {
      ctx.compile(node.body, frame);
    });
    ctx._emitLine('}');

    ctx._emitLine(`} else if (typeof ${arr} === "object") {`);
    if (isFlatArrayBinding(node.name)) {
      const [key, val] = node.name.children;
      const k = ctx._tmpid();
      const v = ctx._tmpid();
      frame.set(key.value, k);
      frame.set(val.value, v);

      ctx._emitLine(`${i} = -1;`);
      ctx._emitLine(`let ${len} = runtime.keys(${arr}).length;`);
      ctx._emitLine(`for(let ${k} in ${arr}) {`);
      ctx._emitLine(`${i}++;`);
      ctx._emitLine(`let ${v} = ${arr}[${k}];`);
      ctx._emitLine(`frame.set("${key.value}", ${k});`);
      ctx._emitLine(`frame.set("${val.value}", ${v});`);

      emitLoopBindings(ctx, arr, i, len);
      ctx._withScopedSyntax(() => {
        ctx.compile(node.body, frame);
      });
      ctx._emitLine('}');
    } else {
      ctx._emitLine(`${i} = -1;`);
      ctx._emitLine(`let ${len} = runtime.keys(${arr}).length;`);
      const k = ctx._tmpid();
      ctx._emitLine(`for(const ${k} in ${arr}) {`);
      ctx._emitLine(`${i}++;`);
      const itemId = ctx._tmpid();
      ctx._emitLine(`let ${itemId} = ${arr}[${k}];`);
      compileDestructuring(ctx, frame, node.name, itemId);

      emitLoopBindings(ctx, arr, i, len);
      ctx._withScopedSyntax(() => {
        ctx.compile(node.body, frame);
      });
      ctx._emitLine('}');
    }

    ctx._emitLine('}');
  } else {
    const v = ctx._tmpid();
    frame.set(node.name.value, v);

    ctx._emitLine(`let ${len} = ${arr}.length;`);
    ctx._emitLine(`for(let ${i}=0; ${i} < ${arr}.length; ${i}++) {`);
    ctx._emitLine(`let ${v} = ${arr}[${i}];`);
    ctx._emitLine(`frame.set("${node.name.value}", ${v});`);

    emitLoopBindings(ctx, arr, i, len);

    ctx._withScopedSyntax(() => {
      ctx.compile(node.body, frame);
    });

    ctx._emitLine('}');
  }

  ctx._emitLine('}');
  if (node.else_) {
    ctx._emitLine('if (!' + len + ') {');
    ctx.compile(node.else_, frame);
    ctx._emitLine('}');
  }

  ctx._emitLine('frame = frame.pop();');
};

export { emitLoopBindings };
