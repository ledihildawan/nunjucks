import type { ForNode, Node } from '@nunjucks/nodes';
import { isArray, isArrayPattern, isObjectPattern } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
import { assertSafeIdentifier } from '../codegen.ts';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';
import { compileDestructuring } from './pattern.ts';

interface LoopContext {
  compiler: Compiler;
  nameNode: Node;
  frame: Frame;
  iterableId: string;
  index: string;
  length: string;
  node: ForNode;
}

const emitLoopBindings = ({
  compiler,
  index,
  length,
}: {
  compiler: Compiler;
  index: string;
  length: string;
}): void => {
  const bindings = [
    { name: 'index', val: `${index} + 1` },
    { name: 'index0', val: index },
    { name: 'revindex', val: `${length} - ${index}` },
    { name: 'revindex0', val: `${length} - ${index} - 1` },
    { name: 'first', val: `${index} === 0` },
    { name: 'last', val: `${index} === ${length} - 1` },
    { name: 'length', val: length },
  ];

  forEach(bindings, (binding) => {
    compiler.emitLine(
      `frame = frame.set({ name: "loop.${binding.name}", value: ${binding.val} });`
    );
  });
};

interface LoopBodyInput {
  compiler: Compiler;
  node: ForNode;
  frame: Frame;
  index: string;
  length: string;
}

const emitLoopBody = ({ compiler, node, frame, index, length }: LoopBodyInput): void => {
  emitLoopBindings({ compiler, index, length });
  compiler.withScopedSyntax(() => {
    compiler.compile(node.body, frame);
  });
};

const isArrayBinding = (node: Node): boolean =>
  isArray(node) || isArrayPattern(node) || isObjectPattern(node);

const isFlatArrayBinding = (node: Node): boolean => isArray(node);

interface SetupForLoopInput {
  compiler: Compiler;
  node: ForNode;
  parentFrame: Frame;
}

const setupForLoop = ({
  compiler,
  node,
  parentFrame,
}: SetupForLoopInput): { frame: Frame; iterableId: string } => {
  const iterableId = compiler.nextCompilerId();
  const frame = parentFrame.push(true);
  compiler.emitLine('frame = frame.push(true);');
  if (compiler.streamErrorRecovery) {
    const { lineno: rawLine, colno: rawCol } = node;
    const lineno = rawLine ?? 0;
    const colno = rawCol ?? 0;
    compiler.emitLine(`let ${iterableId};`);
    compiler.emitLine(`try { ${iterableId} = `);
    compiler.compileExpression(node.arr, frame);
    compiler.emitLine('; ');
    compiler.emitStreamCatch(lineno, colno, `${iterableId} = null`);
  } else {
    compiler.emit(`let ${iterableId} = `);
    compiler.compileExpression(node.arr, frame);
    compiler.emitLine(';');
  }
  compiler.emit(`if(${iterableId}) {`);
  compiler.emitLine(`${iterableId} = runtime.fromIterator(${iterableId});`);
  return { frame, iterableId };
};

const compileFlatArrayBinding = ({
  compiler,
  nameNode,
  frame,
  iterableId,
  index,
  length,
  node,
}: LoopContext): void => {
  const itemId = compiler.nextCompilerId();
  compiler.emitLine(`let ${itemId} = ${iterableId}[${index}];`);
  if (nameNode.children) {
    forEach(nameNode.children, (child, elementIndex) => {
      if (!child) {
        return;
      }
      const childValue = String(child.value);
      assertSafeIdentifier(childValue, { compiler });
      const elementId = compiler.nextCompilerId();
      compiler.emitLine(`let ${elementId} = ${itemId}[${elementIndex}];`);
      compiler.emitLine(
        `frame = frame.set({ name: ${JSON.stringify(childValue)}, value: ${elementId} });`
      );
      frame.set({ name: childValue, value: elementId });
    });
  }
  emitLoopBody({ compiler, node, frame, index, length });
};

const compileFlatObjectBinding = ({
  compiler,
  nameNode,
  frame,
  iterableId,
  index,
  length,
  node,
}: LoopContext): void => {
  const { children } = nameNode;
  const key = children?.[0];
  const value = children?.[1];
  if (!key || !value) {
    return;
  }
  const keyName = String(key.value);
  const valueName = String(value.value);
  assertSafeIdentifier(keyName, { compiler });
  assertSafeIdentifier(valueName, { compiler });
  const keyId = compiler.nextCompilerId();
  const valueId = compiler.nextCompilerId();
  frame.set({ name: keyName, value: keyId });
  frame.set({ name: valueName, value: valueId });

  compiler.emitLine(`${index} = -1;`);
  compiler.emitLine(`${length} = runtime.keys(${iterableId}).length;`);
  compiler.emitLine(`for(let ${keyId} in ${iterableId}) {`);
  compiler.emitLine(`${index}++;`);
  compiler.emitLine(`let ${valueId} = ${iterableId}[${keyId}];`);
  compiler.emitLine(`frame = frame.set({ name: ${JSON.stringify(keyName)}, value: ${keyId} });`);
  compiler.emitLine(
    `frame = frame.set({ name: ${JSON.stringify(valueName)}, value: ${valueId} });`
  );

  emitLoopBody({ compiler, node, frame, index, length });
  compiler.emitLine('}');
};

const compileDestructuredObjectBinding = ({
  compiler,
  nameNode,
  frame,
  iterableId,
  index,
  length,
  node,
}: LoopContext): void => {
  compiler.emitLine(`${index} = -1;`);
  compiler.emitLine(`${length} = runtime.keys(${iterableId}).length;`);
  const keyId = compiler.nextCompilerId();
  compiler.emitLine(`for(const ${keyId} in ${iterableId}) {`);
  compiler.emitLine(`${index}++;`);
  const entryId = compiler.nextCompilerId();
  compiler.emitLine(`let ${entryId} = ${iterableId}[${keyId}];`);
  compileDestructuring({ compiler, frame, registerFrame: true }, nameNode, entryId);

  emitLoopBody({ compiler, node, frame, index, length });
  compiler.emitLine('}');
};

const compileArrayBindingCase = ({
  compiler,
  nameNode,
  frame,
  iterableId,
  index,
  length,
  node,
}: LoopContext): void => {
  compiler.emitLine(`let ${index};`);
  compiler.emitLine(`if(Array.isArray(${iterableId})) {`);
  compiler.emitLine(`${length} = ${iterableId}.length;`);
  compiler.emitLine(`for(${index}=0; ${index} < ${iterableId}.length; ${index}++) {`);

  if (isFlatArrayBinding(nameNode)) {
    compileFlatArrayBinding({ compiler, nameNode, frame, iterableId, index, length, node });
  } else {
    const itemId = compiler.nextCompilerId();
    compiler.emitLine(`let ${itemId} = ${iterableId}[${index}];`);
    compileDestructuring({ compiler, frame, registerFrame: true }, nameNode, itemId);
    emitLoopBody({ compiler, node, frame, index, length });
  }
  compiler.emitLine('}');

  compiler.emitLine(`} else if (typeof ${iterableId} === "object") {`);
  if (isFlatArrayBinding(nameNode)) {
    compileFlatObjectBinding({ compiler, nameNode, frame, iterableId, index, length, node });
  } else {
    compileDestructuredObjectBinding({
      compiler,
      nameNode,
      frame,
      iterableId,
      index,
      length,
      node,
    });
  }
  compiler.emitLine('}');
};

const compileSimpleBinding = ({
  compiler,
  nameNode,
  frame,
  iterableId,
  index,
  length,
  node,
}: LoopContext): void => {
  const valueId = compiler.nextCompilerId();
  const nameValue = String(nameNode.value);
  assertSafeIdentifier(nameValue, { compiler });
  frame.set({ name: nameValue, value: valueId });

  compiler.emitLine(`${length} = ${iterableId}.length;`);
  compiler.emitLine(`for(let ${index}=0; ${index} < ${iterableId}.length; ${index}++) {`);
  compiler.emitLine(`let ${valueId} = ${iterableId}[${index}];`);
  compiler.emitLine(
    `frame = frame.set({ name: ${JSON.stringify(nameValue)}, value: ${valueId} });`
  );

  emitLoopBody({ compiler, node, frame, index, length });

  compiler.emitLine('}');
};

interface EmitForElseOptions {
  compiler: Compiler;
  node: ForNode;
  length: string;
  frame: Frame;
}

const emitForElse = ({ compiler, node, length, frame }: EmitForElseOptions): void => {
  if (node.alternate) {
    compiler.emitLine(`if (!${length}) {`);
    compiler.compile(node.alternate, frame);
    compiler.emitLine('}');
  }
};

/** Compiles `{% for %}` over arrays/objects with destructuring and `{% else %}` on empty. */
export const compileFor = (
  compiler: Compiler,
  { node, frame: parentFrame }: CompileNodeInput<ForNode>
): void => {
  const index = compiler.nextCompilerId();
  const length = compiler.nextCompilerId();
  compiler.emitLine(`let ${length} = 0;`);
  const { frame, iterableId } = setupForLoop({ compiler, node, parentFrame });
  const nameNode = node.name;

  if (isArrayBinding(nameNode)) {
    compileArrayBindingCase({ compiler, nameNode, frame, iterableId, index, length, node });
  } else {
    compileSimpleBinding({ compiler, nameNode, frame, iterableId, index, length, node });
  }

  compiler.emitLine('}');
  emitForElse({ compiler, node, length, frame });
  compiler.emitLine('frame = frame.pop();');
};
