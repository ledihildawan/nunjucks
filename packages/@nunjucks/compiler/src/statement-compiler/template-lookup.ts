import type { ExtendsNode, FromImportNode, ImportNode, IncludeNode, Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { emitLineLocation } from '../codegen.ts';
import type { Compiler } from '../index.ts';

type TemplateCarrier = ExtendsNode | IncludeNode | ImportNode | FromImportNode;

const getLocationFromNode = (node: TemplateCarrier): { lineno: number; colno: number } => {
  const locationNode: Node = node.template;
  const isStringLiteral = locationNode.type === 'literal' && typeof locationNode.value === 'string';
  const extraColno = isStringLiteral ? 1 : 0;
  return {
    lineno: locationNode.lineno,
    colno: (locationNode.colno ?? 0) + extraColno,
  };
};

/** Locates a carrier node's template expression, +1 column for quoted literals. */
export const getTemplateLocation = (node: TemplateCarrier): { lineno: number; colno: number } =>
  getLocationFromNode(node);

interface CompileGetTemplateOptions {
  eagerCompile: boolean;
  includeChain?: string;
  ignoreMissing: boolean;
}

interface CompileGetTemplateInput {
  compiler: Compiler;
  node: TemplateCarrier;
  frame: Frame;
  options: CompileGetTemplateOptions;
}

/**
 * Emits `let t_N = await env.getTemplate({ name, eagerCompile,
 * includeChain, ignoreMissing })` for extends/import/include nodes,
 * returning the template's compiler id.
 */
export const compileGetTemplate = ({
  compiler,
  node,
  frame,
  options,
}: CompileGetTemplateInput): string => {
  const { eagerCompile, includeChain, ignoreMissing } = options;
  const id = compiler.nextCompilerId();
  const location = getLocationFromNode(node);
  emitLineLocation(compiler, location.lineno, location.colno);
  compiler.emit(`let ${id} = await env.getTemplate({ name: `);
  compiler.compileExpression(node.template, frame);
  compiler.emitLine(
    `, eagerCompile: ${eagerCompile}${includeChain ? `, includeChain: ${includeChain}` : ''}, ignoreMissing: ${ignoreMissing} });`
  );
  return id;
};
