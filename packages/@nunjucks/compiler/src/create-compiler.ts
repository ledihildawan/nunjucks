import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { createHtmlContextTracker, type HtmlContext } from '@nunjucks/runtime';
import { DEFAULT_UNDEFINED_MODE, type UndefinedMode } from '@nunjucks/shared';
import { forEach } from 'remeda';
import { fail, getTemplateName, nextCompilerId, pushBuffer, type FailFields } from './codegen.ts';
import {
  assertNodeType,
  compileNodeChildren,
  compileNodeExpression,
} from './compile-expression.ts';
import { compileDispatch } from './node-dispatch.ts';
import {
  addCompilerScopeLevel,
  closeCompilerScopeLevels,
  emitCompilerFuncBegin,
  emitCompilerFuncEnd,
  withCompilerScopedSyntax,
} from './statement-emitter.ts';

export type NodeTypeMatcher = string | { readonly name: string };

export interface Emitter {
  codebuf: string[];
  buffer: string | null;
  bufferStack: Array<string | null>;
  compiledLine: number;
  emit: (code: string) => void;
  emitLine: (code: string, originalLine?: number) => void;
  emitLines: (...lines: string[]) => void;
  pushBuffer: () => string;
  popBuffer: () => void;
  getCode: () => string;
}

export interface ScopeManager {
  scopeStack: string[];
  inBlock: boolean;
  // WHY: set by compileRoot when the template extends another — root-scope OUTPUT
  // (text + {{ }}) is suppressed because the parent's delegation pass renders the
  // page (Jinja parity); block bodies and buffered contexts still compile.
  suppressRootOutput: boolean;
  undefinedMode: UndefinedMode;
  emitFuncBegin: (node: Node, name: string) => void;
  emitFuncEnd: (noReturn?: boolean) => void;
  addScopeLevel: () => void;
  closeScopeLevels: () => void;
  withScopedSyntax: (func: () => void) => void;
}

export interface Compiler extends Emitter, ScopeManager {
  templateName: string | null;
  lastId: number;
  streamErrorRecovery: boolean;
  fail: (options: FailFields) => void;
  nextCompilerId: () => string;
  getTemplateName: () => string;
  emitStreamCatch: (lineno: number, colno: number, defaultAssignment?: string) => void;
  compileChildren: (node: Node, frame: Frame) => void;
  compileExpression: (node: Node, frame: Frame) => void;
  assertType: (node: Node, ...types: NodeTypeMatcher[]) => void;
  compile: (node: Node, frame: Frame) => void;
  getHtmlContext: (lineno: number, colno: number) => HtmlContext;
}

interface CreateCompilerOptions {
  templateName: string | null;
  undefinedMode?: UndefinedMode | undefined;
  source: string;
  streamErrorRecovery?: boolean;
}

export const createCompiler = ({
  templateName,
  undefinedMode,
  source,
  streamErrorRecovery = false,
}: CreateCompilerOptions): Compiler => {
  const contextTracker = createHtmlContextTracker(source);

  const compiler: Compiler = {
    templateName,
    codebuf: [],
    lastId: 0,
    streamErrorRecovery,
    buffer: null,
    bufferStack: [],
    scopeStack: [],
    inBlock: false,
    suppressRootOutput: false,
    undefinedMode: undefinedMode ?? DEFAULT_UNDEFINED_MODE,
    compiledLine: 0,

    fail(options) {
      fail({ ...options, compiler });
    },
    pushBuffer() {
      return pushBuffer(compiler);
    },
    popBuffer() {
      compiler.buffer = compiler.bufferStack.pop() ?? null;
    },
    emit(code) {
      compiler.codebuf.push(code);
    },
    emitLine(code) {
      compiler.compiledLine += 1;
      compiler.emit(`${code}\n`);
    },
    emitLines(...lines) {
      forEach(lines, (line) => compiler.emitLine(line));
    },
    emitFuncBegin(node, name) {
      emitCompilerFuncBegin(compiler, node, name);
    },
    emitFuncEnd(noReturn) {
      emitCompilerFuncEnd(compiler, noReturn);
    },
    addScopeLevel() {
      addCompilerScopeLevel(compiler);
    },
    closeScopeLevels() {
      closeCompilerScopeLevels(compiler);
    },
    withScopedSyntax(func) {
      withCompilerScopedSyntax(compiler, func);
    },
    nextCompilerId() {
      return nextCompilerId(compiler);
    },
    getTemplateName() {
      return getTemplateName(compiler);
    },
    emitStreamCatch(lineno, colno, defaultAssignment) {
      const assignment = defaultAssignment ? `${defaultAssignment}; ` : '';
      compiler.emitLine(
        `} catch (e) { ${assignment}lineno = ${lineno}; colno = ${colno}; yield runtime.streamError(e, { lineno, colno }); }`
      );
    },
    compileChildren(node, frame) {
      compileNodeChildren(compiler, node, frame);
    },
    compileExpression(node, frame) {
      compileNodeExpression(compiler, node, frame);
    },
    assertType(node, ...types) {
      assertNodeType(node, ...types);
    },
    compile(node, frame) {
      return compileDispatch(compiler, { node, frame });
    },
    getCode() {
      return compiler.codebuf.join('');
    },
    getHtmlContext(lineno, colno) {
      return contextTracker.getContextAtLineCol(lineno, colno);
    },
  };

  return compiler;
};
