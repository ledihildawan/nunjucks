import type { Node, ExtendsNode, IncludeNode, ImportNode, FromImportNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { emitLineLocation } from '../codegen.ts';

export interface GetTemplateOptions {
  eagerCompile: boolean;
  ignoreMissing: boolean;
}

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

export const compileGetTemplate = (compiler: Compiler, node: TemplateCarrier, frame: Frame, options: GetTemplateOptions): string => {
  const { eagerCompile, ignoreMissing } = options;
  const id = compiler.tmpid();
  const parentName = compiler.getTemplateName();
  const location = getLocationFromNode(node);
  emitLineLocation(compiler, location.lineno, location.colno);
  compiler.emit(`let ${id} = await env.getTemplate(`);
  compiler.compileExpression(node.template, frame);
  compiler.emitLine(`, ${eagerCompile}, ${parentName}, ${ignoreMissing});`);
  return id;
};
