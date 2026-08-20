import type { Node } from '@nunjucks/nodes';
import { appendTarget } from '../codegen.ts';
import type { Compiler } from '../create-compiler.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';

/** Emits one static-text chunk as `appendTarget` + a JSON string literal. */
export const compileTemplateData = (compiler: Compiler, { node }: CompileNodeInput<Node>): void => {
  compiler.emit(appendTarget(compiler));
  compiler.emit(JSON.stringify(node.value));
  compiler.emit(';');
};
