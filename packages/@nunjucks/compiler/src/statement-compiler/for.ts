import { isArray, isArrayPattern, isObjectPattern } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { compileDestructuring } from './pattern.ts';

const emitLoopBindings = (ctx: Compiler, arr: string, i: string, len: string): void => {
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

const isArrayBinding = (n: Node): boolean =>
  isArray(n) ||
  isArrayPattern(n) ||
  isObjectPattern(n);

const isFlatArrayBinding = (n: Node): boolean => isArray(n);

export const compileFor = (ctx: Compiler, node: Node, frame: Frame): void => {
  const i = ctx._tmpid();
  const len = ctx._tmpid();
  const arr = ctx._tmpid();
  frame = frame.push(true);

  ctx._emitLine('frame = frame.push(true);');

  ctx._emit(`let ${arr} = `);
  ctx._compileExpression(node.arr as Node, frame);
  ctx._emitLine(';');

  ctx._emit(`if(${arr}) {`);
  ctx._emitLine(arr + ' = runtime.fromIterator(' + arr + ');');

  const nameNode = node.name as Node;
  if (isArrayBinding(nameNode)) {
    ctx._emitLine(`let ${i};`);

    ctx._emitLine(`if(Array.isArray(${arr})) {`);
    ctx._emitLine(`let ${len} = ${arr}.length;`);
    ctx._emitLine(`for(${i}=0; ${i} < ${arr}.length; ${i}++) {`);

    const itemId = ctx._tmpid();
    ctx._emitLine(`let ${itemId} = ${arr}[${i}];`);

    if (isFlatArrayBinding(nameNode)) {
      nameNode.children!.forEach((child, u) => {
        const tid = ctx._tmpid();
        ctx._emitLine(`let ${tid} = ${itemId}[${u}];`);
        const childValue = child.value as string;
        ctx._emitLine(`frame.set("${childValue}", ${tid});`);
        frame.set(childValue, tid);
      });
    } else {
      compileDestructuring(ctx, frame, nameNode, itemId);
    }

    emitLoopBindings(ctx, arr, i, len);
    ctx._withScopedSyntax(() => {
      ctx.compile(node.body as Node, frame);
    });
    ctx._emitLine('}');

    ctx._emitLine(`} else if (typeof ${arr} === "object") {`);
    if (isFlatArrayBinding(nameNode)) {
      const [key, val] = nameNode.children!;
      const keyValue = (key as Node).value as string;
      const valValue = (val as Node).value as string;
      const k = ctx._tmpid();
      const v = ctx._tmpid();
      frame.set(keyValue, k);
      frame.set(valValue, v);

      ctx._emitLine(`${i} = -1;`);
      ctx._emitLine(`let ${len} = runtime.keys(${arr}).length;`);
      ctx._emitLine(`for(let ${k} in ${arr}) {`);
      ctx._emitLine(`${i}++;`);
      ctx._emitLine(`let ${v} = ${arr}[${k}];`);
      ctx._emitLine(`frame.set("${keyValue}", ${k});`);
      ctx._emitLine(`frame.set("${valValue}", ${v});`);

      emitLoopBindings(ctx, arr, i, len);
      ctx._withScopedSyntax(() => {
        ctx.compile(node.body as Node, frame);
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
      compileDestructuring(ctx, frame, nameNode, itemId);

      emitLoopBindings(ctx, arr, i, len);
      ctx._withScopedSyntax(() => {
        ctx.compile(node.body as Node, frame);
      });
      ctx._emitLine('}');
    }

    ctx._emitLine('}');
  } else {
    const v = ctx._tmpid();
    const nameValue = nameNode.value as string;
    frame.set(nameValue, v);

    ctx._emitLine(`let ${len} = ${arr}.length;`);
    ctx._emitLine(`for(let ${i}=0; ${i} < ${arr}.length; ${i}++) {`);
    ctx._emitLine(`let ${v} = ${arr}[${i}];`);
    ctx._emitLine(`frame.set("${nameValue}", ${v});`);

    emitLoopBindings(ctx, arr, i, len);

    ctx._withScopedSyntax(() => {
      ctx.compile(node.body as Node, frame);
    });

    ctx._emitLine('}');
  }

  ctx._emitLine('}');
  if (node.else_) {
    ctx._emitLine('if (!' + len + ') {');
    ctx.compile(node.else_ as Node, frame);
    ctx._emitLine('}');
  }

  ctx._emitLine('frame = frame.pop();');
};

export { emitLoopBindings };
