import { isNodeList } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';

const resolveAutoescape = (node: Node): boolean => {
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
    ctx.emit(`let ${res} = await env.getExtension("${node.extName as string}")["${node.prop as string}"](`);
  } else {
    ctx.emit(`env.getExtension("${node.extName as string}")["${node.prop as string}"](`);
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

  if (args) {
    if (!isNodeList(args)) {
      ctx.fail('compileCallExtension: arguments must be a NodeList, ' +
        'use `parser.parseSignature`');
    }
    args.children?.forEach((arg, i, arr) => {
      ctx.compileExpression(arg, frame);
      if (i !== arr.length - 1 || contentArgs.length > 0) {
        ctx.emit(',');
      }
    });
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
  contentArgs.forEach((arg, i) => {
    if (i > 0) {
      ctx.emit(',');
    }
    emitContentArg(ctx, arg, frame);
  });
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

export const compileCallExtension = (ctx: Compiler, node: Node, frame: Frame, useAsync?: boolean): void => {
  const args = node.args as Node;
  const contentArgs = node.contentArgs as Node[];
  const autoescape = resolveAutoescape(node);
  const emitAsync = useAsync || contentArgs.length > 0;
  const res = emitAsync ? ctx.tmpid() : null;

  emitExtensionCallBegin(ctx, node, emitAsync, res);
  emitExtensionArgs(ctx, args, contentArgs, frame);
  emitContentArgs(ctx, contentArgs, frame);
  emitExtensionCallEnd(ctx, emitAsync, res, autoescape);
};

export const compileCallExtensionAsync = (ctx: Compiler, node: Node, frame: Frame): void => {
  compileCallExtension(ctx, node, frame, true);
};
