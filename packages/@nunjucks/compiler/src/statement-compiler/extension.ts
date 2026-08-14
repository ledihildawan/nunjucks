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

interface EmitExtensionCallBeginInput {
  compiler: Compiler;
  node: CallExtensionNode;
  emitAsync: boolean;
  res: string | null;
}

const emitExtensionCallBegin = ({ compiler, node, emitAsync, res }: EmitExtensionCallBeginInput): void => {
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

interface EmitExtensionArgsInput {
  compiler: Compiler;
  args: Node | null;
  contentArgs: readonly Node[];
  frame: Frame;
}

const emitExtensionArgs = ({ compiler, args, contentArgs, frame }: EmitExtensionArgsInput): void => {
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
  for (let i = 0; i < children.length; i++) {
    const argument = children[i];
    if (!argument) { continue; }
    compiler.compileExpression(argument, frame);
    if (i !== lastIndex || contentArgs.length > 0) {
      compiler.emit(',');
    }
  }
};

interface EmitContentArgInput {
  compiler: Compiler;
  argument: Node | null;
  frame: Frame;
}

const emitContentArg = ({ compiler, argument, frame }: EmitContentArgInput): void => {
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

interface EmitContentArgsInput {
  compiler: Compiler;
  contentArgs: readonly Node[];
  frame: Frame;
}

const emitContentArgs = ({ compiler, contentArgs, frame }: EmitContentArgsInput): void => {
  for (let i = 0; i < contentArgs.length; i++) {
    const argument = contentArgs[i];
    if (i > 0) {
      compiler.emit(',');
    }
    if (argument) {
      emitContentArg({ compiler, argument, frame });
    }
  }
};

interface EmitExtensionCallEndInput {
  compiler: Compiler;
  emitAsync: boolean;
  res: string | null;
  autoescape: boolean;
}

const emitExtensionCallEnd = ({ compiler, emitAsync, res, autoescape }: EmitExtensionCallEndInput): void => {
  if (emitAsync) {
    compiler.emit(')');
    compiler.emitLine(
      `\n${appendTarget(compiler)}runtime.suppressValue(await ${res}, { autoescape: ${autoescape} && env.opts.autoescape, lineno, colno });`);
  } else {
    compiler.emit(')');
    compiler.emit(`, { autoescape: ${autoescape} && env.opts.autoescape, lineno, colno });\n`);
  }
};

export const compileCallExtension = (compiler: Compiler, { node, frame }: CompileNodeInput<CallExtensionNode>): void => {
  const args = node.args;
  const contentArgs = node.contentArgs;
  const autoescape = resolveAutoescape(node);
  const emitAsync = contentArgs.length > 0;
  const asyncResultId = emitAsync ? compiler.tmpid() : null;

  emitExtensionCallBegin({ compiler, node, emitAsync, res: asyncResultId });
  emitExtensionArgs({ compiler, args, contentArgs, frame });
  emitContentArgs({ compiler, contentArgs, frame });
  emitExtensionCallEnd({ compiler, emitAsync, res: asyncResultId, autoescape });
};

export const compileCallExtensionAsync = (compiler: Compiler, input: CompileNodeInput<CallExtensionNode>): void => {
  const args = input.node.args;
  const contentArgs = input.node.contentArgs;
  const autoescape = resolveAutoescape(input.node);
  const emitAsync = true;
  const asyncResultId = compiler.tmpid();

  emitExtensionCallBegin({ compiler, node: input.node, emitAsync, res: asyncResultId });
  emitExtensionArgs({ compiler, args, contentArgs, frame: input.frame });
  emitContentArgs({ compiler, contentArgs, frame: input.frame });
  emitExtensionCallEnd({ compiler, emitAsync, res: asyncResultId, autoescape });
};
