import { isNodeList } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';

export const compileCallExtension = (ctx: Compiler, node: Node, frame: Frame, useAsync?: boolean): void => {
  const args = node.args as Node;
  const contentArgs = node.contentArgs as Node[];
  const autoescape = typeof node.autoescape === 'boolean' ? node.autoescape : true;

  if (contentArgs.length > 0) {
    useAsync = true;
  }

  const res = useAsync ? ctx._tmpid() : null;

  if (!useAsync) {
    ctx._emit(`${ctx.buffer} += runtime.suppressValue(`);
  }

  if (useAsync) {
    ctx._emit(`let ${res} = await env.getExtension("${node.extName as string}")["${node.prop as string}"](`);
  } else {
    ctx._emit(`env.getExtension("${node.extName as string}")["${node.prop as string}"](`);
  }

  ctx._emit('context');

  if (args || contentArgs) {
    ctx._emit(',');
  }

  if (args) {
    if (!isNodeList(args)) {
      ctx.fail('compileCallExtension: arguments must be a NodeList, ' +
        'use `parser.parseSignature`');
    }

    args.children!.forEach((arg, i, arr) => {
      ctx._compileExpression(arg, frame);

      if (i !== arr.length - 1 || contentArgs.length) {
        ctx._emit(',');
      }
    });
  }

  if (contentArgs.length) {
    contentArgs.forEach((arg, i) => {
      if (i > 0) {
        ctx._emit(',');
      }

      if (arg) {
        ctx._emitLine('async function() {');
        const id = ctx._pushBuffer();

        ctx.compile(arg, frame);

        ctx._popBuffer();
        ctx._emitLine('return ' + id + ';');
        ctx._emitLine('}');
      } else {
        ctx._emit('null');
      }
    });
  }

  if (useAsync) {
    ctx._emit(')');
    ctx._emitLine(
      `\n${ctx.buffer} += runtime.suppressValue(await ${res}, ${autoescape} && env.opts.autoescape);`);
  } else {
    ctx._emit(')');
    ctx._emit(`, ${autoescape} && env.opts.autoescape);\n`);
  }
};

export const compileCallExtensionAsync = (ctx: Compiler, node: Node, frame: Frame): void => {
  compileCallExtension(ctx, node, frame, true);
};
