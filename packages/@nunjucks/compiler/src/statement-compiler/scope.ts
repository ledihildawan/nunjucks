import type { ScopeNode } from '@nunjucks/nodes';
import { forEach } from 'remeda';
import { assertSafeIdentifier } from '../codegen.ts';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';

/**
 * Compiles `{% scope %}`: emits each assignment into the frame, then runs
 * the body under scoped syntax inside a pushed frame level.
 */
export const compileScope = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<ScopeNode>
): void => {
  // WHY: compile-time frame mirrors the emitted push/pop per the create-compiler contract.
  const bodyFrame = frame.push(true);
  compiler.emitLine('frame = frame.push(true);');

  if (node.assignments?.length > 0) {
    forEach(node.assignments, (pair) => {
      const name = String(pair.key);
      assertSafeIdentifier(name, { compiler });
      const valueId = compiler.nextCompilerId();
      compiler.emitLine(`let ${valueId} = `);
      compiler.compileExpression(pair.value, bodyFrame);
      compiler.emitLine(';');
      compiler.emitLine(
        `frame = frame.set({ name: ${JSON.stringify(name)}, value: ${valueId}, resolveUp: true });`
      );
    });
  }

  compiler.withScopedSyntax(() => {
    compiler.compile(node.body, bodyFrame);
  });

  compiler.emitLine('frame = frame.pop();');
};
