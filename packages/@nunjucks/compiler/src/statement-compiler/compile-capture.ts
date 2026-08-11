import type { CaptureNode } from '@nunjucks/nodes';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';

export const compileCapture = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<CaptureNode>
): void => {
  const { buffer } = compiler;
  const varName = node.name;

  if (varName) {
    compiler.emitLine(`frame = frame.set("${varName}", await (async () => {`);
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
