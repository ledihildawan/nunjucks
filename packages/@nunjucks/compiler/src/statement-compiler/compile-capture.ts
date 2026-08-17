import type { CaptureNode } from '@nunjucks/nodes';
import { assertSafeIdentifier } from '../codegen.ts';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';

/**
 * Compiles `{% capture %}` to an awaited async IIFE that accumulates its
 * body into a local `output` buffer (saved and restored around the body),
 * optionally binding the result to a named frame variable.
 */
export const compileCapture = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<CaptureNode>
): void => {
  const { buffer } = compiler;
  const varName = node.name;

  if (varName) {
    assertSafeIdentifier(varName, { compiler });
    compiler.emitLine(
      `frame = frame.set({ name: ${JSON.stringify(varName)}, value: await (async () => {`
    );
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
    compiler.emitLine('})() });');
  } else {
    compiler.emitLine('})()');
  }

  compiler.buffer = buffer;
};
