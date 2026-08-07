import type { CaptureNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../../index.ts';

export const compileCapture = (
  compiler: Compiler,
  node: CaptureNode,
  frame: Frame
): void => {
  const { buffer } = compiler;
  const varName = node.name;

  if (varName) {
    compiler.emitLine(`frame.set("${varName}", await (async () => {`);
  } else {
    compiler.emitLine('(async () => {');
  }

  compiler.buffer = 'output';
  compiler.emitLine('let output = "";');
  compiler.withScopedSyntax(() => {
    compiler.compile(node.body, frame);
  });
  compiler.emitLine('return output;');

  if (varName) {
    compiler.emitLine('})());');
  } else {
    compiler.emitLine('})()');
  }

  compiler.buffer = buffer;
};
