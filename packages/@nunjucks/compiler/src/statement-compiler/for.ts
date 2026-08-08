import { forEach } from 'remeda';
import { isArray, isArrayPattern, isObjectPattern } from '@nunjucks/nodes';
import type { Node, ForNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';
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

const emitLoopBindings = ({ compiler, i, len }: { compiler: Compiler; i: string; len: string }): void => {
  const bindings = [
    {name: 'index', val: `${i} + 1`},
    {name: 'index0', val: i},
    {name: 'revindex', val: `${len} - ${i}`},
    {name: 'revindex0', val: `${len} - ${i} - 1`},
    {name: 'first', val: `${i} === 0`},
    {name: 'last', val: `${i} === ${len} - 1`},
    {name: 'length', val: len},
  ];

  forEach(bindings, (b) => {
    compiler.emitLine(`frame = frame.set("loop.${b.name}", ${b.val});`);
  });
};

interface LoopBodyInput {
  compiler: Compiler;
  node: ForNode;
  frame: Frame;
  i: string;
  len: string;
}

const emitLoopBody = ({ compiler, node, frame, i, len }: LoopBodyInput): void => {
  emitLoopBindings({ compiler, i, len });
  compiler.withScopedSyntax(() => {
    compiler.compile(node.body, frame);
  });
};

const isArrayBinding = (n: Node): boolean =>
  isArray(n) ||
  isArrayPattern(n) ||
  isObjectPattern(n);

const isFlatArrayBinding = (n: Node): boolean => isArray(n);

const setupForLoop = (compiler: Compiler, node: ForNode, parentFrame: Frame): { frame: Frame; arr: string } => {
  const arr = compiler.tmpid();
  const frame = parentFrame.push(true);
  compiler.emitLine('frame = frame.push(true);');
  compiler.emit(`let ${arr} = `);
  compiler.compileExpression(node.arr, frame);
  compiler.emitLine(';');
  compiler.emit(`if(${arr}) {`);
  compiler.emitLine(`${arr} = runtime.fromIterator(${arr});`);
  return { frame, arr };
};

const compileFlatArrayBinding = ({ ctx: compiler, nameNode, frame, arr, i, len, node }: LoopContext): void => {
  const itemId = compiler.tmpid();
  compiler.emitLine(`let ${itemId} = ${arr}[${i}];`);
  if (nameNode.children) {
    forEach(nameNode.children, (child, u) => {
      if (!child) { return; }
      const tid = compiler.tmpid();
      compiler.emitLine(`let ${tid} = ${itemId}[${u}];`);
      const childValue = child.value as string;
      compiler.emitLine(`frame = frame.set("${childValue}", ${tid});`);
      frame.set(childValue, tid);
    });
  }
  emitLoopBody({ compiler, node, frame, i, len });
};

const compileFlatObjectBinding = ({ ctx: compiler, nameNode, frame, arr, i, len, node }: LoopContext): void => {
  const { children } = nameNode;
  const key = children?.[0];
  const value = children?.[1];
  if (!key || !value) {
    return;
  }
  const keyValue = key.value as string;
  const valValue = value.value as string;
  const k = compiler.tmpid();
  const v = compiler.tmpid();
  frame.set(keyValue, k);
  frame.set(valValue, v);

  compiler.emitLine(`${i} = -1;`);
  compiler.emitLine(`${len} = runtime.keys(${arr}).length;`);
  compiler.emitLine(`for(let ${k} in ${arr}) {`);
  compiler.emitLine(`${i}++;`);
  compiler.emitLine(`let ${v} = ${arr}[${k}];`);
  compiler.emitLine(`frame = frame.set("${keyValue}", ${k});`);
  compiler.emitLine(`frame = frame.set("${valValue}", ${v});`);

  emitLoopBody({ compiler, node, frame, i, len });
  compiler.emitLine('}');
};

const compileDestructuredObjectBinding = ({ ctx: compiler, nameNode, frame, arr, i, len, node }: LoopContext): void => {
  compiler.emitLine(`${i} = -1;`);
  compiler.emitLine(`${len} = runtime.keys(${arr}).length;`);
  const k = compiler.tmpid();
  compiler.emitLine(`for(const ${k} in ${arr}) {`);
  compiler.emitLine(`${i}++;`);
  const entryId = compiler.tmpid();
  compiler.emitLine(`let ${entryId} = ${arr}[${k}];`);
  compileDestructuring({ ctx: compiler, frame, registerFrame: true }, nameNode, entryId);

  emitLoopBody({ compiler, node, frame, i, len });
  compiler.emitLine('}');
};

const compileArrayBindingCase = ({ ctx: compiler, nameNode, frame, arr, i, len, node }: LoopContext): void => {
  compiler.emitLine(`let ${i};`);
  compiler.emitLine(`if(Array.isArray(${arr})) {`);
  compiler.emitLine(`${len} = ${arr}.length;`);
  compiler.emitLine(`for(${i}=0; ${i} < ${arr}.length; ${i}++) {`);

  if (isFlatArrayBinding(nameNode)) {
    compileFlatArrayBinding({ ctx: compiler, nameNode, frame, arr, i, len, node });
  } else {
    const itemId = compiler.tmpid();
    compiler.emitLine(`let ${itemId} = ${arr}[${i}];`);
    compileDestructuring({ ctx: compiler, frame, registerFrame: true }, nameNode, itemId);
    emitLoopBody({ compiler, node, frame, i, len });
  }
  compiler.emitLine('}');

  compiler.emitLine(`} else if (typeof ${arr} === "object") {`);
  if (isFlatArrayBinding(nameNode)) {
    compileFlatObjectBinding({ ctx: compiler, nameNode, frame, arr, i, len, node });
  } else {
    compileDestructuredObjectBinding({ ctx: compiler, nameNode, frame, arr, i, len, node });
  }
  compiler.emitLine('}');
};

const compileSimpleBinding = ({ ctx: compiler, nameNode, frame, arr, i, len, node }: LoopContext): void => {
  const v = compiler.tmpid();
  const nameValue = nameNode.value as string;
  frame.set(nameValue, v);

  compiler.emitLine(`${len} = ${arr}.length;`);
  compiler.emitLine(`for(let ${i}=0; ${i} < ${arr}.length; ${i}++) {`);
  compiler.emitLine(`let ${v} = ${arr}[${i}];`);
  compiler.emitLine(`frame = frame.set("${nameValue}", ${v});`);

  emitLoopBody({ compiler, node, frame, i, len });

  compiler.emitLine('}');
};

const emitForElse = (compiler: Compiler, node: ForNode, len: string, frame: Frame): void => {
  if (node.alternate) {
    compiler.emitLine(`if (!${len}) {`);
    compiler.compile(node.alternate, frame);
    compiler.emitLine('}');
  }
};

export const compileFor = (compiler: Compiler, { node, frame: parentFrame }: CompileNodeInput<ForNode>): void => {
  const i = compiler.tmpid();
  const len = compiler.tmpid();
  compiler.emitLine(`let ${len} = 0;`);
  const { frame, arr } = setupForLoop(compiler, node, parentFrame);
  const nameNode = node.name;

  if (isArrayBinding(nameNode)) {
    compileArrayBindingCase({ ctx: compiler, nameNode, frame, arr, i, len, node });
  } else {
    compileSimpleBinding({ ctx: compiler, nameNode, frame, arr, i, len, node });
  }

  compiler.emitLine('}');
  emitForElse(compiler, node, len, frame);
  compiler.emitLine('frame = frame.pop();');
};
