import type { IfNode, WalrusNode } from '@nunjucks/nodes';
import { isArrayPattern, isObjectPattern, isSymbol } from '@nunjucks/nodes';
import { assertSafeIdentifier, emitLocationGuard } from '../codegen.ts';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';
import { compileDestructuring } from '../statement-compiler/pattern.ts';

export const compileInlineIf = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<IfNode>
): void => {
  // WHY: runtime.isTruthy folds miss sentinels to falsy (mirrors compileIf).
  compiler.emit('(runtime.isTruthy(');
  compiler.compile(node.cond, frame);
  compiler.emit(')?');
  compiler.compile(node.body, frame);
  compiler.emit(':');
  if (node.alternate === null) {
    compiler.emit('""');
  } else {
    compiler.compile(node.alternate, frame);
  }
  compiler.emit(')');
};

export const compileWalrus = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<WalrusNode>
): void => {
  if (isSymbol(node.target)) {
    const target = node.target;
    assertSafeIdentifier(target.value, { compiler, lineno: node.lineno, colno: node.colno });
    const valueId = compiler.nextCompilerId();
    emitLocationGuard(compiler, node.lineno, node.colno);
    compiler.emit('(() => {');
    compiler.emit(`let ${valueId} = `);
    compiler.compile(node.value, frame);
    compiler.emit(';');
    compiler.emit(
      `frame = frame.set({ name: ${JSON.stringify(target.value)}, value: ${valueId}, resolveUp: true });`
    );
    compiler.emit(`return ${valueId};`);
    compiler.emit('})())');
  } else if (isArrayPattern(node.target) || isObjectPattern(node.target)) {
    const target = node.target;
    const valueId = compiler.nextCompilerId();
    emitLocationGuard(compiler, node.lineno, node.colno);
    compiler.emit('(() => {');
    compiler.emit(`let ${valueId} = `);
    compiler.compile(node.value, frame);
    compiler.emit(';');
    compileDestructuring({ compiler, frame, registerFrame: false }, target, valueId);
    compiler.emit(`return ${valueId};`);
    compiler.emit('})())');
  } else {
    compiler.fail(
      'Walrus target must be a symbol or destructuring pattern',
      node.lineno,
      node.colno
    );
  }
};
