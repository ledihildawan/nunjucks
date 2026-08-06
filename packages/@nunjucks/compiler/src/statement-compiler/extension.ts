import { isNodeList } from '@nunjucks/nodes';
import type { Node, CallExtensionNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';

const resolveAutoescape = (node: CallExtensionNode): boolean => {
  const { autoescape: nodeAutoescape } = node;
  return typeof nodeAutoescape === 'boolean' ? nodeAutoescape : true;
};

const emitExtensionCallBegin = (
  ctx: Compiler,
  node: Node,
  emitAsync: boolean,
  res: string | null
): void => {
  if (!emitAsync) {
    ctx.emit(`${ctx.buffer} += runtime.suppressValue(`);
  }
  if (emitAsync) {
    ctx.emit(`let ${res} = await env.getExtension("${(node as CallExtensionNode).extName as string}")["${(node as CallExtensionNode).prop as string}"](`);
  } else {
    ctx.emit(`env.getExtension("${(node as CallExtensionNode).extName as string}")["${(node as CallExtensionNode).prop as string}"](`);
  }
  ctx.emit('context');
};

const emitExtensionArgs = (
  ctx: Compiler,
  args: Node | null,
  contentArgs: Node[],
  frame: Frame
): void => {
  if (!args && contentArgs.length === 0) {
    return;
  }
  ctx.emit(',');
  if (!args) { return; }
  if (!isNodeList(args)) {
    ctx.fail('compileCallExtension: arguments must be a NodeList, ' +
      'use `parser.parseSignature`');
  }
  if (!args.children) { return; }
  for (let i = 0; i < args.children.length; i++) {
    const arg = args.children[i];
    if (!arg) { continue; }
    ctx.compileExpression(arg, frame);
    if (i !== args.children.length - 1 || contentArgs.length > 0) {
      ctx.emit(',');
    }
  }
};

const emitContentArg = (ctx: Compiler, arg: Node | null, frame: Frame): void => {
  if (arg) {
    ctx.emitLine('async function() {');
    const id = ctx.pushBuffer();
    ctx.compile(arg, frame);
    ctx.popBuffer();
    ctx.emitLine(`return ${id};`);
    ctx.emitLine('}');
  } else {
    ctx.emit('null');
  }
};

const emitContentArgs = (
  ctx: Compiler,
  contentArgs: Node[],
  frame: Frame
): void => {
  for (let i = 0; i < contentArgs.length; i++) {
    if (i > 0) {
      ctx.emit(',');
    }
    const arg = contentArgs[i];
    if (arg) {
      emitContentArg(ctx, arg, frame);
    }
  }
};

const emitExtensionCallEnd = (
  ctx: Compiler,
  emitAsync: boolean,
  res: string | null,
  autoescape: boolean
): void => {
  if (emitAsync) {
    ctx.emit(')');
    ctx.emitLine(
      `\n${ctx.buffer} += runtime.suppressValue(await ${res}, ${autoescape} && env.opts.autoescape, lineno, colno);`);
  } else {
    ctx.emit(')');
    ctx.emit(`, ${autoescape} && env.opts.autoescape, lineno, colno);\n`);
  }
};

export const compileCallExtension = (ctx: Compiler, node: CallExtensionNode, frame: Frame, useAsync?: boolean): void => {
  const args = node.args;
  const contentArgs = node.contentArgs;
  const autoescape = resolveAutoescape(node);
  const emitAsync = useAsync || contentArgs.length > 0;
  const res = emitAsync ? ctx.tmpid() : null;

  emitExtensionCallBegin(ctx, node, emitAsync, res);
  emitExtensionArgs(ctx, args, contentArgs, frame);
  emitContentArgs(ctx, contentArgs, frame);
  emitExtensionCallEnd(ctx, emitAsync, res, autoescape);
};

export const compileCallExtensionAsync = (ctx: Compiler, node: CallExtensionNode, frame: Frame): void => {
  compileCallExtension(ctx, node, frame, true);
};
