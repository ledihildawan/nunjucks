import { isArrayPattern, isObjectPattern, isSymbol } from '@nunjucks/nodes';
import type { IfNode, WalrusNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { emitLocationGuard } from '../codegen.ts';
import { compileDestructuring } from '../statement-compiler/pattern.ts';

export const compileInlineIf = (compiler: Compiler, node: IfNode, frame: Frame): void => {
  compiler.emit('(');
  compiler.compile(node.cond, frame);
  compiler.emit('?');
  compiler.compile(node.body, frame);
  compiler.emit(':');
  if (node.else_ === null) {
    compiler.emit('""');
  } else {
    compiler.compile(node.else_, frame);
  }
  compiler.emit(')');
};

export const compileWalrus = (compiler: Compiler, node: WalrusNode, frame: Frame): void => {
  if (isSymbol(node.target)) {
    const target = node.target;
    const valueId = compiler.tmpid();
    emitLocationGuard(compiler, node.lineno, node.colno);
    compiler.emit('(() => {');
    compiler.emit(`let ${valueId} = `);
    compiler.compile(node.value, frame);
    compiler.emit(';');
    compiler.emit(`frame.set(${JSON.stringify(target.value)}, ${valueId}, true);`);
    compiler.emit(`return ${valueId};`);
    compiler.emit('})())');
  } else if (isArrayPattern(node.target) || isObjectPattern(node.target)) {
    const target = node.target;
    const valueId = compiler.tmpid();
    emitLocationGuard(compiler, node.lineno, node.colno);
    compiler.emit('(() => {');
    compiler.emit(`let ${valueId} = `);
    compiler.compile(node.value, frame);
    compiler.emit(';');
    compileDestructuring({ ctx: compiler, frame, registerFrame: false }, target, valueId);
    compiler.emit(`return ${valueId};`);
    compiler.emit('})())');
  } else {
    compiler.fail('Walrus target must be a symbol or destructuring pattern', node.lineno, node.colno);
  }
};
