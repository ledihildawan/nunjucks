import type { CallExtensionNode, Node } from '@nunjucks/nodes';
import { isNodeList } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { appendTarget } from '../codegen.ts';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';

const resolveAutoescape = (node: CallExtensionNode): boolean => {
  const { autoescape: nodeAutoescape } = node;
  return typeof nodeAutoescape === 'boolean' ? nodeAutoescape : true;
};

interface EmitExtensionCallBeginInput {
  compiler: Compiler;
  node: CallExtensionNode;
  emitAsync: boolean;
  asyncResultId: string | null;
}

const emitExtensionCallBegin = ({
  compiler,
  node,
  emitAsync,
  asyncResultId,
}: EmitExtensionCallBeginInput): void => {
  if (!emitAsync) {
    // WHY: `await` resolves a Promise returned by the extension fn before suppressValue runs — without it, a sync extension that unexpectedly returns a thenable would yield "[object Promise]" (silent corruption in both blocking and streaming paths). Root is always an async generator (Option B), so await is valid here; on a non-Promise result it is a no-op (one microtask, no semantic change).
    compiler.emit(`${appendTarget(compiler)}runtime.suppressValue(await `);
  }
  if (emitAsync) {
    compiler.emit(
      `let ${asyncResultId} = await env.getExtension(${JSON.stringify(node.extName)})[${JSON.stringify(node.prop)}](`
    );
  } else {
    compiler.emit(
      `env.getExtension(${JSON.stringify(node.extName)})[${JSON.stringify(node.prop)}](`
    );
  }
  compiler.emit('context');
};

interface EmitExtensionArgsInput {
  compiler: Compiler;
  args: Node | null;
  contentArgs: readonly Node[];
  frame: Frame;
}

const emitExtensionArgs = ({
  compiler,
  args,
  contentArgs,
  frame,
}: EmitExtensionArgsInput): void => {
  if (!args && contentArgs.length === 0) {
    return;
  }
  compiler.emit(',');
  if (!args) {
    return;
  }
  if (!isNodeList(args)) {
    compiler.fail({
      message: 'compileCallExtension: arguments must be a NodeList, use `parser.parseSignature`',
    });
  }
  if (!args.children) {
    return;
  }
  const children = args.children;
  const lastIndex = children.length - 1;
  // WHY: imperative index loop — comma placement between emitted fragments is
  // index-sensitive and the trailing comma depends on contentArgs; a map().join()
  // cannot interleave into the shared emit buffer. Compiler emission exemption.
  for (let i = 0; i < children.length; i++) {
    const argument = children[i];
    if (!argument) {
      continue;
    }
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
  // WHY: imperative index loop — comma placement between emitted fragments is
  // index-sensitive; a map().join() cannot interleave into the shared emit buffer.
  // Compiler emission exemption.
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
  asyncResultId: string | null;
  autoescape: boolean;
}

const emitExtensionCallEnd = ({
  compiler,
  emitAsync,
  asyncResultId,
  autoescape,
}: EmitExtensionCallEndInput): void => {
  if (emitAsync) {
    compiler.emit(')');
    compiler.emitLine(
      `\n${appendTarget(compiler)}runtime.suppressValue(await ${asyncResultId}, { autoescape: ${autoescape} && env.opts.autoescape, lineno, colno });`
    );
  } else {
    compiler.emit(')');
    compiler.emit(`, { autoescape: ${autoescape} && env.opts.autoescape, lineno, colno });\n`);
  }
};

/**
 * Compiles an extension tag call for the no-content-args path: emits
 * `appendTarget` + `runtime.suppressValue(await ext(...))` in one
 * expression with autoescape options inline.
 */
export const compileCallExtension = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<CallExtensionNode>
): void => {
  const args = node.args;
  const contentArgs = node.contentArgs;
  const autoescape = resolveAutoescape(node);
  const emitAsync = contentArgs.length > 0;
  const asyncResultId = emitAsync ? compiler.nextCompilerId() : null;

  emitExtensionCallBegin({ compiler, node, emitAsync, asyncResultId });
  emitExtensionArgs({ compiler, args, contentArgs, frame });
  emitContentArgs({ compiler, contentArgs, frame });
  emitExtensionCallEnd({ compiler, emitAsync, asyncResultId, autoescape });
};

/**
 * Compiles the content-args variant: the awaited extension call lands in a
 * `t_N` temporary, then `suppressValue` emits it with autoescape options.
 */
export const compileCallExtensionAsync = (
  compiler: Compiler,
  input: CompileNodeInput<CallExtensionNode>
): void => {
  const args = input.node.args;
  const contentArgs = input.node.contentArgs;
  const autoescape = resolveAutoescape(input.node);
  const emitAsync = true;
  const asyncResultId = compiler.nextCompilerId();

  emitExtensionCallBegin({ compiler, node: input.node, emitAsync, asyncResultId });
  emitExtensionArgs({ compiler, args, contentArgs, frame: input.frame });
  emitContentArgs({ compiler, contentArgs, frame: input.frame });
  emitExtensionCallEnd({ compiler, emitAsync, asyncResultId, autoescape });
};
