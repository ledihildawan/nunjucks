import { NodeList } from '../../nodes.js';

export const compileCallExtension = (ctx, node, frame, useAsync) => {
  const args = node.args;
  const contentArgs = node.contentArgs;
  const autoescape = typeof node.autoescape === 'boolean' ? node.autoescape : true;

  if (contentArgs.length > 0) {
    useAsync = true;
  }

  const res = useAsync ? ctx._tmpid() : null;

  if (!useAsync) {
    ctx._emit(`${ctx.buffer} += runtime.suppressValue(`);
  }

  if (useAsync) {
    ctx._emit(`var ${res} = await env.getExtension("${node.extName}")["${node.prop}"](`);
  } else {
    ctx._emit(`env.getExtension("${node.extName}")["${node.prop}"](`);
  }

  ctx._emit('context');

  if (args || contentArgs) {
    ctx._emit(',');
  }

  if (args) {
    if (!(args instanceof NodeList)) {
      ctx.fail('compileCallExtension: arguments must be a NodeList, ' +
        'use `parser.parseSignature`');
    }

    args.children.forEach((arg, i) => {
      ctx._compileExpression(arg, frame);

      if (i !== args.children.length - 1 || contentArgs.length) {
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

export const compileCallExtensionAsync = (ctx, node, frame) => {
  compileCallExtension(ctx, node, frame, true);
};
