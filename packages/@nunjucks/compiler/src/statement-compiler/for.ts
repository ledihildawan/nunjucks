import { isArray, isArrayPattern, isObjectPattern } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { compileDestructuring } from './pattern.ts';

const emitLoopBindings = (ctx: Compiler, _arr: string, i: string, len: string): void => {
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
    ctx.emitLine(`frame.set("loop.${b.name}", ${b.val});`);
  });
};

const isArrayBinding = (n: Node): boolean =>
  isArray(n) ||
  isArrayPattern(n) ||
  isObjectPattern(n);

const isFlatArrayBinding = (n: Node): boolean => isArray(n);

export const compileFor = (ctx: Compiler, node: Node, frame: Frame): void => {
  const i = ctx.tmpid();
  const len = ctx.tmpid();
  const arr = ctx.tmpid();
  frame = frame.push(true);

  ctx.emitLine('frame = frame.push(true);');

  ctx.emit(`let ${arr} = `);
  ctx.compileExpression(node.arr as Node, frame);
  ctx.emitLine(';');

  ctx.emit(`if(${arr}) {`);
  ctx.emitLine(`${arr} = runtime.fromIterator(${arr});`);

  const nameNode = node.name as Node;
  if (isArrayBinding(nameNode)) {
    ctx.emitLine(`let ${i};`);

    ctx.emitLine(`if(Array.isArray(${arr})) {`);
    ctx.emitLine(`let ${len} = ${arr}.length;`);
    ctx.emitLine(`for(${i}=0; ${i} < ${arr}.length; ${i}++) {`);

    const itemId = ctx.tmpid();
    ctx.emitLine(`let ${itemId} = ${arr}[${i}];`);

    if (isFlatArrayBinding(nameNode)) {
      nameNode.children?.forEach((child, u) => {
        const tid = ctx.tmpid();
        ctx.emitLine(`let ${tid} = ${itemId}[${u}];`);
        const childValue = child.value as string;
        ctx.emitLine(`frame.set("${childValue}", ${tid});`);
        frame.set(childValue, tid);
      });
    } else {
      compileDestructuring(ctx, frame, nameNode, itemId);
    }

    emitLoopBindings(ctx, arr, i, len);
    ctx.withScopedSyntax(() => {
      ctx.compile(node.body as Node, frame);
    });
    ctx.emitLine('}');

    ctx.emitLine(`} else if (typeof ${arr} === "object") {`);
    if (isFlatArrayBinding(nameNode)) {
      const children = nameNode.children;
      if (!children || children.length < 2) {
        return;
      }
      const [key, val] = children;
      const keyValue = (key as Node).value as string;
      const valValue = (val as Node).value as string;
      const k = ctx.tmpid();
      const v = ctx.tmpid();
      frame.set(keyValue, k);
      frame.set(valValue, v);

      ctx.emitLine(`${i} = -1;`);
      ctx.emitLine(`let ${len} = runtime.keys(${arr}).length;`);
      ctx.emitLine(`for(let ${k} in ${arr}) {`);
      ctx.emitLine(`${i}++;`);
      ctx.emitLine(`let ${v} = ${arr}[${k}];`);
      ctx.emitLine(`frame.set("${keyValue}", ${k});`);
      ctx.emitLine(`frame.set("${valValue}", ${v});`);

      emitLoopBindings(ctx, arr, i, len);
      ctx.withScopedSyntax(() => {
        ctx.compile(node.body as Node, frame);
      });
      ctx.emitLine('}');
    } else {
      ctx.emitLine(`${i} = -1;`);
      ctx.emitLine(`let ${len} = runtime.keys(${arr}).length;`);
      const k = ctx.tmpid();
      ctx.emitLine(`for(const ${k} in ${arr}) {`);
      ctx.emitLine(`${i}++;`);
      const itemId = ctx.tmpid();
      ctx.emitLine(`let ${itemId} = ${arr}[${k}];`);
      compileDestructuring(ctx, frame, nameNode, itemId);

      emitLoopBindings(ctx, arr, i, len);
      ctx.withScopedSyntax(() => {
        ctx.compile(node.body as Node, frame);
      });
      ctx.emitLine('}');
    }

    ctx.emitLine('}');
  } else {
    const v = ctx.tmpid();
    const nameValue = nameNode.value as string;
    frame.set(nameValue, v);

    ctx.emitLine(`let ${len} = ${arr}.length;`);
    ctx.emitLine(`for(let ${i}=0; ${i} < ${arr}.length; ${i}++) {`);
    ctx.emitLine(`let ${v} = ${arr}[${i}];`);
    ctx.emitLine(`frame.set("${nameValue}", ${v});`);

    emitLoopBindings(ctx, arr, i, len);

    ctx.withScopedSyntax(() => {
      ctx.compile(node.body as Node, frame);
    });

    ctx.emitLine('}');
  }

  ctx.emitLine('}');
  if (node.else_) {
    ctx.emitLine(`if (!${len}) {`);
    ctx.compile(node.else_ as Node, frame);
    ctx.emitLine('}');
  }

  ctx.emitLine('frame = frame.pop();');
};

export { emitLoopBindings };
