import type { Node, ExtendsNode, IncludeNode, ImportNode, FromImportNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { emitLineLocation } from '../codegen.ts';

type TemplateCarrier = ExtendsNode | IncludeNode | ImportNode | FromImportNode;

const getLocationFromNode = (node: TemplateCarrier): { lineno: number; colno: number } => {
  const locationNode: Node = node.template;
  const isStringLiteral = locationNode.type === 'literal' && typeof locationNode.value === 'string';
  const extraColno = isStringLiteral ? 1 : 0;
  return {
    lineno: locationNode.lineno,
    colno: (locationNode.colno ?? 0) + extraColno
  };
};

export const getTemplateLocation = (node: TemplateCarrier): { lineno: number; colno: number } => getLocationFromNode(node);

export interface CompileGetTemplateOptions {
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

export const compileGetTemplate = ({ compiler, node, frame, options }: CompileGetTemplateInput): string => {
  const { eagerCompile, includeChain, ignoreMissing } = options;
  const id = compiler.tmpid();
  const location = getLocationFromNode(node);
  emitLineLocation(compiler, location.lineno, location.colno);
  compiler.emit(`let ${id} = await env.getTemplate({ name: `);
  compiler.compileExpression(node.template, frame);
  compiler.emitLine(`, eagerCompile: ${eagerCompile}${includeChain ? `, includeChain: ${includeChain}` : ''}, ignoreMissing: ${ignoreMissing} });`);
  return id;
};
