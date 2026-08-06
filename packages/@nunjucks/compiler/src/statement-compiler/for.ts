import { isArray, isArrayPattern, isObjectPattern } from '@nunjucks/nodes';
import type { Node, ForNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
import type { Compiler } from '../index.ts';
import { compileDestructuring } from './pattern.ts';

interface LoopContext {
  ctx: Compiler;
  nameNode: Node;
  frame: Frame;
  arr: string;
  i: string;
  len: string;
  node: ForNode;
}

const emitLoopBindings = (ctx: Compiler, i: string, len: string): void => {
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

const emitLoopBody = (ctx: Compiler, node: ForNode, frame: Frame, i: string, len: string): void => {
  emitLoopBindings(ctx, i, len);
  ctx.withScopedSyntax(() => {
    ctx.compile(node.body, frame);
  });
};

const isArrayBinding = (n: Node): boolean =>
  isArray(n) ||
  isArrayPattern(n) ||
  isObjectPattern(n);

const isFlatArrayBinding = (n: Node): boolean => isArray(n);

const setupForLoop = (ctx: Compiler, node: ForNode, parentFrame: Frame): { frame: Frame; arr: string } => {
  const arr = ctx.tmpid();
  const frame = parentFrame.push(true);
  ctx.emitLine('frame = frame.push(true);');
  ctx.emit(`let ${arr} = `);
  ctx.compileExpression(node.arr, frame);
  ctx.emitLine(';');
  ctx.emit(`if(${arr}) {`);
  ctx.emitLine(`${arr} = runtime.fromIterator(${arr});`);
  return { frame, arr };
};

const compileFlatArrayBinding = ({ ctx, nameNode, frame, arr, i, len, node }: LoopContext): void => {
  const itemId = ctx.tmpid();
  ctx.emitLine(`let ${itemId} = ${arr}[${i}];`);
  if (nameNode.children) {
    for (let u = 0; u < nameNode.children.length; u++) {
      const child = nameNode.children[u];
      if (!child) { continue; }
      const tid = ctx.tmpid();
      ctx.emitLine(`let ${tid} = ${itemId}[${u}];`);
      const childValue = child.value as string;
      ctx.emitLine(`frame.set("${childValue}", ${tid});`);
      frame.set(childValue, tid);
    }
  }
  emitLoopBody(ctx, node, frame, i, len);
};

const compileFlatObjectBinding = ({ ctx, nameNode, frame, arr, i, len, node }: LoopContext): void => {
  const { children } = nameNode;
  const key = children?.[0];
  const val = children?.[1];
  if (!key || !val) {
    return;
  }
  const keyValue = key.value as string;
  const valValue = val.value as string;
  const k = ctx.tmpid();
  const v = ctx.tmpid();
  frame.set(keyValue, k);
  frame.set(valValue, v);

  ctx.emitLine(`${i} = -1;`);
  ctx.emitLine(`${len} = runtime.keys(${arr}).length;`);
  ctx.emitLine(`for(let ${k} in ${arr}) {`);
  ctx.emitLine(`${i}++;`);
  ctx.emitLine(`let ${v} = ${arr}[${k}];`);
  ctx.emitLine(`frame.set("${keyValue}", ${k});`);
  ctx.emitLine(`frame.set("${valValue}", ${v});`);

  emitLoopBody(ctx, node, frame, i, len);
  ctx.emitLine('}');
};

const compileDestructuredObjectBinding = ({ ctx, nameNode, frame, arr, i, len, node }: LoopContext): void => {
  ctx.emitLine(`${i} = -1;`);
  ctx.emitLine(`${len} = runtime.keys(${arr}).length;`);
  const k = ctx.tmpid();
  ctx.emitLine(`for(const ${k} in ${arr}) {`);
  ctx.emitLine(`${i}++;`);
  const entryId = ctx.tmpid();
  ctx.emitLine(`let ${entryId} = ${arr}[${k}];`);
  compileDestructuring({ ctx, frame, registerFrame: true }, nameNode, entryId);

  emitLoopBody(ctx, node, frame, i, len);
  ctx.emitLine('}');
};

const compileArrayBindingCase = ({ ctx, nameNode, frame, arr, i, len, node }: LoopContext): void => {
  ctx.emitLine(`let ${i};`);
  ctx.emitLine(`if(Array.isArray(${arr})) {`);
  ctx.emitLine(`${len} = ${arr}.length;`);
  ctx.emitLine(`for(${i}=0; ${i} < ${arr}.length; ${i}++) {`);

  if (isFlatArrayBinding(nameNode)) {
    compileFlatArrayBinding({ ctx, nameNode, frame, arr, i, len, node });
  } else {
    const itemId = ctx.tmpid();
    ctx.emitLine(`let ${itemId} = ${arr}[${i}];`);
    compileDestructuring({ ctx, frame, registerFrame: true }, nameNode, itemId);
    emitLoopBody(ctx, node, frame, i, len);
  }
  ctx.emitLine('}');

  ctx.emitLine(`} else if (typeof ${arr} === "object") {`);
  if (isFlatArrayBinding(nameNode)) {
    compileFlatObjectBinding({ ctx, nameNode, frame, arr, i, len, node });
  } else {
    compileDestructuredObjectBinding({ ctx, nameNode, frame, arr, i, len, node });
  }
  ctx.emitLine('}');
};

const compileSimpleBinding = ({ ctx, nameNode, frame, arr, i, len, node }: LoopContext): void => {
  const v = ctx.tmpid();
  const nameValue = nameNode.value as string;
  frame.set(nameValue, v);

  ctx.emitLine(`${len} = ${arr}.length;`);
  ctx.emitLine(`for(let ${i}=0; ${i} < ${arr}.length; ${i}++) {`);
  ctx.emitLine(`let ${v} = ${arr}[${i}];`);
  ctx.emitLine(`frame.set("${nameValue}", ${v});`);

  emitLoopBody(ctx, node, frame, i, len);

  ctx.emitLine('}');
};

const emitForElse = (ctx: Compiler, node: ForNode, len: string, frame: Frame): void => {
  if (node.else_) {
    ctx.emitLine(`if (!${len}) {`);
    ctx.compile(node.else_, frame);
    ctx.emitLine('}');
  }
};

export const compileFor = (ctx: Compiler, node: ForNode, parentFrame: Frame): void => {
  const i = ctx.tmpid();
  const len = ctx.tmpid();
  ctx.emitLine(`let ${len} = 0;`);
  const { frame, arr } = setupForLoop(ctx, node, parentFrame);
  const nameNode = node.name;

  if (isArrayBinding(nameNode)) {
    compileArrayBindingCase({ ctx, nameNode, frame, arr, i, len, node });
  } else {
    compileSimpleBinding({ ctx, nameNode, frame, arr, i, len, node });
  }

  ctx.emitLine('}');
  emitForElse(ctx, node, len, frame);
  ctx.emitLine('frame = frame.pop();');
};
