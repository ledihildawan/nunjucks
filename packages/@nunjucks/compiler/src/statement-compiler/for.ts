import { isArray, isArrayPattern, isObjectPattern } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
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

  forEach(bindings, b => {
    ctx.emitLine(`frame.set("loop.${b.name}", ${b.val});`);
  });
};

const isArrayBinding = (n: Node): boolean =>
  isArray(n) ||
  isArrayPattern(n) ||
  isObjectPattern(n);

const isFlatArrayBinding = (n: Node): boolean => isArray(n);

const setupForLoop = (ctx: Compiler, node: Node, parentFrame: Frame): { frame: Frame; arr: string } => {
  const arr = ctx.tmpid();
  const frame = parentFrame.push(true);
  ctx.emitLine('frame = frame.push(true);');
  ctx.emit(`let ${arr} = `);
  ctx.compileExpression(node.arr as Node, frame);
  ctx.emitLine(';');
  ctx.emit(`if(${arr}) {`);
  ctx.emitLine(`${arr} = runtime.fromIterator(${arr});`);
  return { frame, arr };
};

const compileFlatArrayBinding = (
  ctx: Compiler,
  nameNode: Node,
  frame: Frame,
  arr: string,
  i: string,
  len: string,
  node: Node
): void => {
  const itemId = ctx.tmpid();
  ctx.emitLine(`let ${itemId} = ${arr}[${i}];`);
  nameNode.children?.forEach((child, u) => {
    const tid = ctx.tmpid();
    ctx.emitLine(`let ${tid} = ${itemId}[${u}];`);
    const childValue = child.value as string;
    ctx.emitLine(`frame.set("${childValue}", ${tid});`);
    frame.set(childValue, tid);
  });
  emitLoopBindings(ctx, arr, i, len);
  ctx.withScopedSyntax(() => {
    ctx.compile(node.body as Node, frame);
  });
};

const compileFlatObjectBinding = (
  ctx: Compiler,
  nameNode: Node,
  frame: Frame,
  arr: string,
  i: string,
  len: string,
  node: Node
): void => {
  const { children } = nameNode;
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
};

const compileDestructuredObjectBinding = (
  ctx: Compiler,
  nameNode: Node,
  frame: Frame,
  arr: string,
  i: string,
  len: string,
  node: Node
): void => {
  ctx.emitLine(`${i} = -1;`);
  ctx.emitLine(`let ${len} = runtime.keys(${arr}).length;`);
  const k = ctx.tmpid();
  ctx.emitLine(`for(const ${k} in ${arr}) {`);
  ctx.emitLine(`${i}++;`);
  const entryId = ctx.tmpid();
  ctx.emitLine(`let ${entryId} = ${arr}[${k}];`);
  compileDestructuring({ ctx, frame, registerFrame: true }, nameNode, entryId);

  emitLoopBindings(ctx, arr, i, len);
  ctx.withScopedSyntax(() => {
    ctx.compile(node.body as Node, frame);
  });
  ctx.emitLine('}');
};

const compileArrayBindingCase = (
  ctx: Compiler,
  node: Node,
  nameNode: Node,
  frame: Frame,
  arr: string,
  i: string,
  len: string
): void => {
  ctx.emitLine(`let ${i};`);
  ctx.emitLine(`if(Array.isArray(${arr})) {`);
  ctx.emitLine(`let ${len} = ${arr}.length;`);
  ctx.emitLine(`for(${i}=0; ${i} < ${arr}.length; ${i}++) {`);

  if (isFlatArrayBinding(nameNode)) {
    compileFlatArrayBinding(ctx, nameNode, frame, arr, i, len, node);
  } else {
    const itemId = ctx.tmpid();
    ctx.emitLine(`let ${itemId} = ${arr}[${i}];`);
    compileDestructuring({ ctx, frame, registerFrame: true }, nameNode, itemId);
    emitLoopBindings(ctx, arr, i, len);
    ctx.withScopedSyntax(() => {
      ctx.compile(node.body as Node, frame);
    });
  }
  ctx.emitLine('}');

  ctx.emitLine(`} else if (typeof ${arr} === "object") {`);
  if (isFlatArrayBinding(nameNode)) {
    compileFlatObjectBinding(ctx, nameNode, frame, arr, i, len, node);
  } else {
    compileDestructuredObjectBinding(ctx, nameNode, frame, arr, i, len, node);
  }
  ctx.emitLine('}');
};

const compileSimpleBinding = (
  ctx: Compiler,
  node: Node,
  nameNode: Node,
  frame: Frame,
  arr: string,
  i: string,
  len: string
): void => {
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
};

const emitForElse = (ctx: Compiler, node: Node, len: string, frame: Frame): void => {
  if (node.else_) {
    ctx.emitLine(`if (!${len}) {`);
    ctx.compile(node.else_ as Node, frame);
    ctx.emitLine('}');
  }
};

export const compileFor = (ctx: Compiler, node: Node, parentFrame: Frame): void => {
  const i = ctx.tmpid();
  const len = ctx.tmpid();
  const { frame, arr } = setupForLoop(ctx, node, parentFrame);
  const nameNode = node.name as Node;

  if (isArrayBinding(nameNode)) {
    compileArrayBindingCase(ctx, node, nameNode, frame, arr, i, len);
  } else {
    compileSimpleBinding(ctx, node, nameNode, frame, arr, i, len);
  }

  ctx.emitLine('}');
  emitForElse(ctx, node, len, frame);
  ctx.emitLine('frame = frame.pop();');
};

export { emitLoopBindings };
