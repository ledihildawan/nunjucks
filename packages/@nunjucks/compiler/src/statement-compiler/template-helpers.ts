import type { Node, ExtendsNode, IncludeNode, ImportNode, FromImportNode, NodeLocation } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { emitLineLocation } from '../compiler-helpers.ts';

export interface GetTemplateOptions {
  eagerCompile: boolean;
  ignoreMissing: boolean;
}

type TemplateCarrier = ExtendsNode | IncludeNode | ImportNode | FromImportNode;

const getLocationFromNode = (node: TemplateCarrier): NodeLocation => {
  const locationNode: Node = node.template;
  const isStringLiteral = locationNode.type === 'literal' && typeof locationNode.value === 'string';
  const extraColno = isStringLiteral ? 1 : 0;
  return {
    lineno: locationNode.lineno,
    colno: (locationNode.colno ?? 0) + extraColno
  };
};

export const getTemplateLocation = (node: TemplateCarrier): NodeLocation => getLocationFromNode(node);

export const compileGetTemplate = (ctx: Compiler, node: TemplateCarrier, frame: Frame, options: GetTemplateOptions): string => {
  const { eagerCompile, ignoreMissing } = options;
  const id = ctx.tmpid();
  const parentName = ctx.getTemplateName();
  const location = getLocationFromNode(node);
  emitLineLocation(ctx, location.lineno, location.colno);
  ctx.emit(`let ${id} = await env.getTemplate(`);
  ctx.compileExpression(node.template, frame);
  ctx.emitLine(`, ${eagerCompile}, ${parentName}, ${ignoreMissing});`);
  return id;
};
