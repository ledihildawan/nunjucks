import {
  isCompoundAssignment,
  isOptionalCall,
  isOptionalChain,
  isPipe,
  isTemplateData,
  isVariableAssignment,
  isVariableDeclaration,
} from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../../index.ts';
import { extractLocation, extractVarName } from './extract-location.ts';

const emitEnsureDefinedClose = (
  ctx: Compiler,
  child: Node,
  lineno: number,
  colno: number
): void => {
  const name = extractVarName(child);
  const nameArg = name ? `, "${name}"` : ', null';
  const modeArg = ctx.undefinedMode ? `, "${ctx.undefinedMode}"` : '';
  ctx.emit(`,${lineno},${colno}${nameArg}, null${modeArg})`);
};

const isVariableLike = (child: Node): boolean =>
  isVariableDeclaration(child) ||
  isVariableAssignment(child) ||
  isCompoundAssignment(child);

const compileTemplateDataChild = (ctx: Compiler, child: Node): void => {
  if (child.value) {
    ctx.emit(`${ctx.buffer} += `);
    ctx.emit(JSON.stringify(child.value));
    ctx.emit(';');
  }
};

const compileOutputChild = (
  ctx: Compiler,
  child: Node,
  frame: Frame
): void => {
  const isPipeType = isPipe(child);
  const isOptional = isOptionalChain(child) || isOptionalCall(child);
  const { lineno: rawLine, colno: rawColumn } = extractLocation(child);
  const lineno = rawLine ?? 0;
  const colno = rawColumn ?? 0;
  const useEnsureDefined = !isOptional || ctx.undefinedMode === 'debug';
  const htmlContext = ctx.getHtmlContext(lineno, colno);

  ctx.emitLineWithMapping(
    `lineno = ${lineno}; colno = ${colno}; ${ctx.buffer} += runtime.suppressValue(`,
    lineno,
    colno
  );
  if (!isPipeType) {
    ctx.emit('await runtime.awaitValue(');
  }
  if (useEnsureDefined) {
    ctx.emit('runtime.ensureDefined(');
  }
  ctx.compile(child, frame);
  if (useEnsureDefined) {
    emitEnsureDefinedClose(ctx, child, lineno, colno);
  }
  if (!isPipeType) {
    ctx.emit(')');
  }
  ctx.emit(`, env.opts.autoescape, lineno, colno, "${htmlContext}");`);
};

const processOutputChild = (
  ctx: Compiler,
  child: Node,
  frame: Frame
): void => {
  if (isTemplateData(child)) {
    compileTemplateDataChild(ctx, child);
    return;
  }
  if (isVariableLike(child)) {
    ctx.compile(child, frame);
    return;
  }
  compileOutputChild(ctx, child, frame);
};

export const compileOutput = (
  ctx: Compiler,
  node: Node,
  frame: Frame
): void => {
  for (const child of node.children ?? []) {
    processOutputChild(ctx, child, frame);
  }
  ctx.emit('\n');
};
