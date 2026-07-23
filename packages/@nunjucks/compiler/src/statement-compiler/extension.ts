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

  const res = useAsync ? ctx.tmpid() : null;

  if (!useAsync) {
    ctx.emit(`${ctx.buffer} += runtime.suppressValue(`);
  }

  if (useAsync) {
    ctx.emit(`let ${res} = await env.getExtension("${node.extName as string}")["${node.prop as string}"](`);
  } else {
    ctx.emit(`env.getExtension("${node.extName as string}")["${node.prop as string}"](`);
  }

  ctx.emit('context');

  if (args || contentArgs) {
    ctx.emit(',');
  }

  if (args) {
    if (!isNodeList(args)) {
      ctx.fail('compileCallExtension: arguments must be a NodeList, ' +
        'use `parser.parseSignature`');
    }

    args.children!.forEach((arg, i, arr) => {
      ctx.compileExpression(arg, frame);

      if (i !== arr.length - 1 || contentArgs.length) {
        ctx.emit(',');
      }
    });
  }

  if (contentArgs.length) {
    contentArgs.forEach((arg, i) => {
      if (i > 0) {
        ctx.emit(',');
      }

      if (arg) {
        ctx.emitLine('async function() {');
        const id = ctx.pushBuffer();

        ctx.compile(arg, frame);

        ctx.popBuffer();
        ctx.emitLine('return ' + id + ';');
        ctx.emitLine('}');
      } else {
        ctx.emit('null');
      }
    });
  }

  if (useAsync) {
    ctx.emit(')');
    ctx.emitLine(
      `\n${ctx.buffer} += runtime.suppressValue(await ${res}, ${autoescape} && env.opts.autoescape, lineno, colno);`);
  } else {
    ctx.emit(')');
    ctx.emit(`, ${autoescape} && env.opts.autoescape, lineno, colno);\n`);
  }
};

export const compileCallExtensionAsync = (ctx: Compiler, node: Node, frame: Frame): void => {
  compileCallExtension(ctx, node, frame, true);
};
