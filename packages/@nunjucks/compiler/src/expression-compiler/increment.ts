import { ERROR_CODES } from '@nunjucks/error-catalog';
import type { IncDecNode } from '@nunjucks/nodes';
import { isSymbol } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { emitLocationGuard } from '../codegen.ts';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';

interface IncrementDecrementOptions {
  operator: string;
}

const compileIncrementDecrement = (
  compiler: Compiler,
  node: IncDecNode,
  _frame: Frame,
  { operator }: IncrementDecrementOptions
): void => {
  const target = node.target;

  if (isSymbol(target)) {
    const varName = target.value;
    const id = compiler.nextCompilerId();

    emitLocationGuard(compiler, node.lineno, node.colno);
    compiler.emit('(() => {');
    compiler.emit(
      `let ${id} = runtime.contextOrFrameLookup(context, frame, ${JSON.stringify(varName)});`
    );

    if (node.isPostfix) {
      compiler.emit(`let result = ${id};`);
      compiler.emit(`${id} = ${id} ${operator} 1;`);
    } else {
      compiler.emit(`${id} = ${id} ${operator} 1;`);
      compiler.emit(`let result = ${id};`);
    }

    compiler.emit(
      `frame = frame.set({ name: ${JSON.stringify(varName)}, value: ${id}, resolveUp: true });`
    );
    compiler.emit(`context = context.setVariable(${JSON.stringify(varName)}, ${id});`);
    compiler.emit('return result;');
    compiler.emit('})())');
  } else {
    emitLocationGuard(compiler, node.lineno, node.colno);
    compiler.emit(
      `(() => { const err = new Error('Invalid left-hand side expression'); err.code = ${JSON.stringify(ERROR_CODES.INVALID_ASSIGN_TARGET)}; throw err; })())`
    );
  }
};

export const compileIncrement = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<IncDecNode>
): void => {
  compileIncrementDecrement(compiler, node, frame, { operator: '+' });
};

export const compileDecrement = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<IncDecNode>
): void => {
  compileIncrementDecrement(compiler, node, frame, { operator: '-' });
};
