import { isDict, isKeywordArgs } from '@nunjucks/nodes';
import type { MacroNode, CallerNode, Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { createFrame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';

type MacroLikeNode = MacroNode | CallerNode;

const compileMacro = (ctx: Compiler, node: Node, frame?: Frame): string => {
  const args: Node[] = [];
  let kwargs: Node | null = null;
  const funcId = `macro_${ctx.tmpid()}`;
  const keepFrame = (frame !== undefined);

  const argsChildren = (node as MacroLikeNode).args;
  argsChildren?.forEach((arg, i, arr) => {
    if (i === arr.length - 1 && (isDict(arg) || isKeywordArgs(arg))) {
      kwargs = arg;
    } else {
      ctx.assertType(arg, 'symbol');
      args.push(arg);
    }
  });

  kwargs = kwargs as Node | null;

  const realNames = [...args.map((n) => `l_${n.value as string}`), 'kwargs'];

  const argNames = args.map((n) => `"${n.value as string}"`);
  const kwargNames = ((kwargs && (kwargs.children as Node[])) || []).map((n) => `"${((n.key as Node).value as string)}"`);

  let currFrame: Frame;
  if (keepFrame) {
    currFrame = frame?.push(true);
  } else {
    currFrame = createFrame();
  }
  let frameAssignment: string;
  if (keepFrame) {
    frameAssignment = 'frame.push(true);';
  } else {
    frameAssignment = 'runtime.createFrame();';
  }
  ctx.emitLines(
    `let ${funcId} = runtime.makeMacro(`,
    `[${argNames.join(', ')}], `,
    `[${kwargNames.join(', ')}], `,
    `async (${realNames.join(', ')}) => {`,
    'let callerFrame = frame;',
    `frame = ${frameAssignment}`,
    'kwargs = kwargs || {};',
    'if (Object.prototype.hasOwnProperty.call(kwargs, "caller")) {',
    'frame.set("caller", kwargs.caller); }');

  for (const arg of args) {
    const argValue = arg.value as string;
    ctx.emitLine(`frame.set("${argValue}", l_${argValue});`);
    currFrame.set(argValue, `l_${argValue}`);
  }

  if (kwargs) {
    for (const pair of (kwargs.children as Node[])) {
      const name = (pair.key as Node).value as string;
      ctx.emit(`frame.set("${name}", `);
      ctx.emit(`Object.prototype.hasOwnProperty.call(kwargs, "${name}")`);
      ctx.emit(` ? kwargs["${name}"] : `);
      ctx.compileExpression(pair.value as Node, currFrame);
      ctx.emit(');');
    }
  }

  const bufferId = ctx.pushBuffer();

  ctx.withScopedSyntax(() => {
    ctx.compile(node.body as Node, currFrame);
  });

  let frameRestore: string;
  if (keepFrame) {
    frameRestore = 'frame.pop();';
  } else {
    frameRestore = 'callerFrame;';
  }
  ctx.emitLine(`frame = ${frameRestore}`);
  ctx.emitLine(`return runtime.createSafeString(${bufferId});`);
  ctx.emitLine('});');
  ctx.popBuffer();

  return funcId;
};

export const compileMacroPublic = (ctx: Compiler, node: Node, frame: Frame): void => {
  const funcId = compileMacro(ctx, node);

  const name = node.name as string;
  frame.set(name, funcId);

  if (frame.parent) {
    ctx.emitLine(`frame.set("${name}", ${funcId});`);
  } else {
    const nameValue = node.name as string;
    if (nameValue.charAt(0) !== '_') {
      ctx.emitLine(`context.addExport("${name}");`);
    }
    ctx.emitLine(`context.setVariable("${name}", ${funcId});`);
  }
};

export const compileCaller = (ctx: Compiler, node: Node, frame: Frame): void => {
  ctx.emit('(function (){');
  const funcId = compileMacro(ctx, node, frame);
  ctx.emit(`return ${funcId};})()`);
};
