import type { ImportNode } from '@nunjucks/nodes';
import { assertSafeIdentifier } from '../codegen.ts';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';
import { compileGetTemplate } from './template-lookup.ts';

/** Compiles `{% import %}`: binds the template's full `getExported()` object to the target. */
export const compileImport = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<ImportNode>
): void => {
  const target = node.target;
  assertSafeIdentifier(target, { compiler });
  const id = compileGetTemplate({
    compiler,
    node,
    frame,
    options: {
      eagerCompile: false,
      ignoreMissing: false,
      includeChain: compiler.getTemplateName(),
    },
  });

  const withContextArg = node.withContext ? 'context.getVariables(), frame' : '';
  compiler.emitLine(`let ${id}_exported = await ${id}.getExported(${withContextArg});`);

  if (frame.parent) {
    compiler.emitLine(
      `frame = frame.set({ name: ${JSON.stringify(target)}, value: ${id}_exported });`
    );
  } else {
    compiler.emitLine(`context = context.setVariable(${JSON.stringify(target)}, ${id}_exported);`);
  }
};
