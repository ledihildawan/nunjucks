import { isNodeList } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';

export const compileCallExtension = (ctx: Compiler, node: Node, frame: Frame, useAsync?: boolean): void => {
  const args = node.args as Node;
  const contentArgs = node.contentArgs as Node[];
  const { autoescape: nodeAutoescape } = node;
  let autoescape: boolean;
  if (typeof nodeAutoescape === 'boolean') {
    autoescape = nodeAutoescape;
  } else {
    autoescape = true;
  }

  // Content args force the async form regardless of what the caller asked for.
  const emitAsync = useAsync || contentArgs.length > 0;

  let res: string | null;
  if (emitAsync) {
    res = ctx.tmpid();
  } else {
    res = null;
  }

  if (!emitAsync) {
    ctx.emit(`${ctx.buffer} += runtime.suppressValue(`);
  }

  if (emitAsync) {
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

    args.children?.forEach((arg, i, arr) => {
      ctx.compileExpression(arg, frame);

      if (i !== arr.length - 1 || contentArgs.length > 0) {
        ctx.emit(',');
      }
    });
  }

  if (contentArgs.length > 0) {
    contentArgs.forEach((arg, i) => {
      if (i > 0) {
        ctx.emit(',');
      }

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
    });
  }

  if (emitAsync) {
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
