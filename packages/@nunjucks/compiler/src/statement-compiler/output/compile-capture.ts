import type { CaptureNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../../index.ts';

/**
 * Compile CaptureNode — the shared "render block to string" primitive.
 *
 * Two modes (justified — two distinct consumers):
 * 1. name = null: Used by `{% filter %}` block as a building block.
 *    Emits bare async IIFE whose return value is piped through a filter.
 * 2. name = "varName": Used by `{% capture varName %}` standalone tag.
 *    Emits `frame.set("varName", await IIFE)` to store the rendered string.
 */
export const compileCapture = (
  ctx: Compiler,
  node: CaptureNode,
  frame: Frame
): void => {
  const { buffer } = ctx;
  const varName = node.name;

  if (varName) {
    ctx.emitLine(`frame.set("${varName}", await (async () => {`);
  } else {
    ctx.emitLine('(async () => {');
  }

  ctx.buffer = 'output';
  ctx.emitLine('let output = "";');
  ctx.withScopedSyntax(() => {
    ctx.compile(node.body, frame);
  });
  ctx.emitLine('return output;');

  if (varName) {
    ctx.emitLine('})());');
  } else {
    ctx.emitLine('})()');
  }

  ctx.buffer = buffer;
};
