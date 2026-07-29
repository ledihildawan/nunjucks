
import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
import { compileDispatch } from './node-dispatch.ts';
import { DEFAULT_UNDEFINED_MODE, type UndefinedMode } from '@nunjucks/runtime/undefined';
import { createHtmlContextTracker, type HtmlContext } from '@nunjucks/shared';
import {
  fail as failCompiler,
  getTemplateName as getCompilerTemplateName,
  pushBuffer as pushCompilerBuffer,
  tmpid as nextCompilerId,
} from './compiler-helpers.ts';
import {
  assertType as assertNodeType,
  compileChildren as compileNodeChildren,
  compileExpression as compileNodeExpression,
} from './compile-expression.ts';
import {
  addScopeLevel as addCompilerScopeLevel,
  closeScopeLevels as closeCompilerScopeLevels,
  emitFuncBegin as emitCompilerFuncBegin,
  emitFuncEnd as emitCompilerFuncEnd,
  withScopedSyntax as withCompilerScopedSyntax,
} from './compile-statement.ts';

/**
 * How `assertType` identifies an acceptable node kind: either the node type
 * name directly, or a node factory from `@nunjucks/nodes` matched by its
 * function name. Named here so the interface and the implementation share one
 * definition instead of restating `string | Function` at each site.
 */
export type NodeTypeMatcher = string | { readonly name: string };

export interface Compiler {
  templateName: string | null;
  codebuf: string[];
  lastId: number;
  buffer: string | null;
  bufferStack: Array<string | null>;
  scopeClosers: string;
  inBlock: boolean;
  undefinedMode: UndefinedMode;
  compiledLine: number;
  fail: (msg: string, lineno?: number, colno?: number) => void;
  pushBuffer: () => string;
  popBuffer: () => string | null;
  emit: (code: string) => void;
  emitLine: (code: string, originalLine?: number) => void;
  emitLines: (...lines: string[]) => void;
  emitFuncBegin: (node: Node, name: string) => void;
  emitFuncEnd: (noReturn?: boolean) => void;
  addScopeLevel: () => void;
  closeScopeLevels: () => void;
  withScopedSyntax: (func: () => void) => void;
  tmpid: () => string;
  getTemplateName: () => string;
  compileChildren: (node: Node, frame?: Frame) => void;
  compileExpression: (node: Node, frame?: Frame) => void;
  assertType: (node: Node, ...types: NodeTypeMatcher[]) => void;
  compile: (node: Node, frame?: Frame) => unknown;
  getCode: () => string;
  getHtmlContext: (lineno: number, colno: number) => HtmlContext;
}

const createCompilerMethods = (
  compiler: Compiler,
  contextTracker: ReturnType<typeof createHtmlContextTracker>
): Partial<Compiler> => ({
    fail: (msg, lineno, colno) => failCompiler(compiler, msg, lineno, colno),
    pushBuffer: () => pushCompilerBuffer(compiler),
    popBuffer: () => {
      compiler.buffer = compiler.bufferStack.pop() as string | null;
      return null;
    },
    emit: (code: string) => compiler.codebuf.push(code),
    emitLine: (code: string) => {
      compiler.compiledLine += 1;
      compiler.emit(`${code}\n`);
    },
    emitLines: (...lines: string[]) => {
      forEach(lines, line => compiler.emitLine(line));
    },
    emitFuncBegin: (node, name) => emitCompilerFuncBegin(compiler, node, name),
    emitFuncEnd: noReturn => emitCompilerFuncEnd(compiler, noReturn),
    addScopeLevel: () => addCompilerScopeLevel(compiler),
    closeScopeLevels: () => closeCompilerScopeLevels(compiler),
    withScopedSyntax: func => withCompilerScopedSyntax(compiler, func),
    tmpid: () => nextCompilerId(compiler),
    getTemplateName: () => getCompilerTemplateName(compiler),
    compileChildren: (node, frame) => compileNodeChildren(compiler, node, frame),
    compileExpression: (node, frame) => compileNodeExpression(compiler, node, frame),
    assertType: (node, ...types) => assertNodeType(node, ...types),
    compile: (node: Node, frame?: Frame) => compileDispatch(compiler, node, frame),
    getCode: () => compiler.codebuf.join(''),
    getHtmlContext: (lineno: number, colno: number) => contextTracker.getContextAtLineCol(lineno, colno),
});

export function createCompiler(
  templateName: string | null,
  undefinedMode: UndefinedMode | undefined,
  source: string
): Compiler {
  const compiler = {
    templateName,
    codebuf: [],
    lastId: 0,
    buffer: null,
    bufferStack: [],
    scopeClosers: '',
    inBlock: false,
    undefinedMode: undefinedMode || DEFAULT_UNDEFINED_MODE,
    compiledLine: 0,
  } as unknown as Compiler;
  Object.assign(
    compiler,
    createCompilerMethods(compiler, createHtmlContextTracker(source))
  );
  return compiler;
}
