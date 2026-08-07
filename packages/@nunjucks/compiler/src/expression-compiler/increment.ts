import { isSymbol } from '@nunjucks/nodes';
import type { IncDecNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { emitLocationGuard } from '../codegen.ts';

const compileIncrementDecrement = (compiler: Compiler, node: IncDecNode, _frame: Frame, op: string): void => {
  const target = node.target;

  if (isSymbol(target)) {
    const varName = target.value;
    const id = compiler.tmpid();

    emitLocationGuard(compiler, node.lineno, node.colno);
    compiler.emit('(() => {');
    compiler.emit(`let ${id} = runtime.contextOrFrameLookup(context, frame, "${varName}");`);

    if (node.isPostfix) {
      compiler.emit(`let result = ${id};`);
      compiler.emit(`${id} = ${id} ${op} 1;`);
    } else {
      compiler.emit(`${id} = ${id} ${op} 1;`);
      compiler.emit(`let result = ${id};`);
    }

    compiler.emit(`frame.set("${varName}", ${id}, true);`);
    compiler.emit(`context.setVariable("${varName}", ${id});`);
    compiler.emit('return result;');
    compiler.emit('})())');
  } else {
    emitLocationGuard(compiler, node.lineno, node.colno);
    compiler.emit('(() => { throw new Error("Invalid left-hand side expression"); })())');
  }
};

export const compileIncrement = (compiler: Compiler, node: IncDecNode, frame: Frame): void => {
  compileIncrementDecrement(compiler, node, frame, '+');
};

export const compileDecrement = (compiler: Compiler, node: IncDecNode, frame: Frame): void => {
  compileIncrementDecrement(compiler, node, frame, '-');
};
