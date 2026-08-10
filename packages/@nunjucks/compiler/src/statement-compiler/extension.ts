import { isNodeList } from '@nunjucks/nodes';
import type { Node, CallExtensionNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';
import { appendTarget } from '../codegen.ts';

const resolveAutoescape = (node: CallExtensionNode): boolean => {
  const { autoescape: nodeAutoescape } = node;
  return typeof nodeAutoescape === 'boolean' ? nodeAutoescape : true;
};

const emitExtensionCallBegin = (
  compiler: Compiler,
  node: CallExtensionNode,
  emitAsync: boolean,
  res: string | null
): void => {
  if (!emitAsync) {
    // WHY: `await` resolves a Promise returned by the extension fn before suppressValue runs — without it, a sync extension that unexpectedly returns a thenable would yield "[object Promise]" (silent corruption in both blocking and streaming paths). Root is always an async generator (Option B), so await is valid here; on a non-Promise result it is a no-op (one microtask, no semantic change).
    compiler.emit(`${appendTarget(compiler)}runtime.suppressValue(await `);
  }
  if (emitAsync) {
    compiler.emit(`let ${res} = await env.getExtension(${JSON.stringify(node.extName)})[${JSON.stringify(node.prop)}](`);
  } else {
    compiler.emit(`env.getExtension(${JSON.stringify(node.extName)})[${JSON.stringify(node.prop)}](`);
  }
  compiler.emit('context');
};

const emitExtensionArgs = (
  compiler: Compiler,
  args: Node | null,
  contentArgs: readonly Node[],
  frame: Frame
): void => {
  if (!args && contentArgs.length === 0) {
    return;
  }
  compiler.emit(',');
  if (!args) { return; }
  if (!isNodeList(args)) {
    compiler.fail('compileCallExtension: arguments must be a NodeList, ' +
      'use `parser.parseSignature`');
  }
  if (!args.children) { return; }
  const children = args.children;
  const lastIndex = children.length - 1;
  children.forEach((argument, i) => {
    if (!argument) { return; }
    compiler.compileExpression(argument, frame);
    if (i !== lastIndex || contentArgs.length > 0) {
      compiler.emit(',');
    }
  });
};

const emitContentArg = (compiler: Compiler, argument: Node | null, frame: Frame): void => {
  if (argument) {
    compiler.emitLine('async function() {');
    const id = compiler.pushBuffer();
    compiler.compile(argument, frame);
    compiler.popBuffer();
    compiler.emitLine(`return ${id};`);
    compiler.emitLine('}');
  } else {
    compiler.emit('null');
  }
};

const emitContentArgs = (
  compiler: Compiler,
  contentArgs: readonly Node[],
  frame: Frame
): void => {
  contentArgs.forEach((argument, i) => {
    if (i > 0) {
      compiler.emit(',');
    }
    if (argument) {
      emitContentArg(compiler, argument, frame);
    }
  });
};

const emitExtensionCallEnd = (
  compiler: Compiler,
  emitAsync: boolean,
  res: string | null,
  autoescape: boolean
): void => {
  if (emitAsync) {
    compiler.emit(')');
    compiler.emitLine(
      `\n${appendTarget(compiler)}runtime.suppressValue(await ${res}, { autoescape: ${autoescape} && env.opts.autoescape, lineno, colno });`);
  } else {
    compiler.emit(')');
    compiler.emit(`, { autoescape: ${autoescape} && env.opts.autoescape, lineno, colno });\n`);
  }
};

export const compileCallExtension = (compiler: Compiler, { node, frame }: CompileNodeInput<CallExtensionNode>, useAsync = false): void => {
  const args = node.args;
  const contentArgs = node.contentArgs;
  const autoescape = resolveAutoescape(node);
  const emitAsync = useAsync || contentArgs.length > 0;
  const res = emitAsync ? compiler.tmpid() : null;

  emitExtensionCallBegin(compiler, node, emitAsync, res);
  emitExtensionArgs(compiler, args, contentArgs, frame);
  emitContentArgs(compiler, contentArgs, frame);
  emitExtensionCallEnd(compiler, emitAsync, res, autoescape);
};

export const compileCallExtensionAsync = (compiler: Compiler, input: CompileNodeInput<CallExtensionNode>): void => {
  compileCallExtension(compiler, input, true);
};
