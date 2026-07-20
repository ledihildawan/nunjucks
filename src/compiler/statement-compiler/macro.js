import { nodes } from '../../nodes/index.js';
import { createFrame } from '../../runtime/index.js';

const compileMacro = (ctx, node, frame) => {
  const args = [];
  let kwargs = null;
  const funcId = 'macro_' + ctx._tmpid();
  const keepFrame = (frame !== undefined);

  node.args.children.forEach((arg, i, arr) => {
    if (i === arr.length - 1 && (nodes.isDict(arg) || nodes.isKeywordArgs(arg))) {
      kwargs = arg;
    } else {
      ctx.assertType(arg, 'symbol');
      args.push(arg);
    }
  });

  const realNames = [...args.map((n) => `l_${n.value}`), 'kwargs'];

  const argNames = args.map((n) => `"${n.value}"`);
  const kwargNames = ((kwargs && kwargs.children) || []).map((n) => `"${n.key.value}"`);

  let currFrame;
  if (keepFrame) {
    currFrame = frame.push(true);
  } else {
    currFrame = createFrame();
  }
  ctx._emitLines(
    `let ${funcId} = runtime.makeMacro(`,
    `[${argNames.join(', ')}], `,
    `[${kwargNames.join(', ')}], `,
    `async (${realNames.join(', ')}) => {`,
    'let callerFrame = frame;',
    'frame = ' + ((keepFrame) ? 'frame.push(true);' : 'runtime.createFrame();'),
    'kwargs = kwargs || {};',
    'if (Object.prototype.hasOwnProperty.call(kwargs, "caller")) {',
    'frame.set("caller", kwargs.caller); }');

  args.forEach((arg) => {
    ctx._emitLine(`frame.set("${arg.value}", l_${arg.value});`);
    currFrame.set(arg.value, `l_${arg.value}`);
  });

  if (kwargs) {
    kwargs.children.forEach((pair) => {
      const name = pair.key.value;
      ctx._emit(`frame.set("${name}", `);
      ctx._emit(`Object.prototype.hasOwnProperty.call(kwargs, "${name}")`);
      ctx._emit(` ? kwargs["${name}"] : `);
      ctx._compileExpression(pair.value, currFrame);
      ctx._emit(');');
    });
  }

  const bufferId = ctx._pushBuffer();

  ctx._withScopedSyntax(() => {
    ctx.compile(node.body, currFrame);
  });

  ctx._emitLine('frame = ' + ((keepFrame) ? 'frame.pop();' : 'callerFrame;'));
  ctx._emitLine(`return runtime.createSafeString(${bufferId});`);
  ctx._emitLine('});');
  ctx._popBuffer();

  return funcId;
};

export const compileMacroPublic = (ctx, node, frame) => {
  const funcId = compileMacro(ctx, node);

  const name = node.name.value;
  frame.set(name, funcId);

  if (frame.parent) {
    ctx._emitLine(`frame.set("${name}", ${funcId});`);
  } else {
    if (node.name.value.charAt(0) !== '_') {
      ctx._emitLine(`context.addExport("${name}");`);
    }
    ctx._emitLine(`context.setVariable("${name}", ${funcId});`);
  }
};

export const compileCaller = (ctx, node, frame) => {
  ctx._emit('(function (){');
  const funcId = compileMacro(ctx, node, frame);
  ctx._emit(`return ${funcId};})()`);
};
