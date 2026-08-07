
import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';

import { forEach } from 'remeda';
import { compileDispatch } from './node-dispatch.ts';
import { DEFAULT_UNDEFINED_MODE, type UndefinedMode } from '@nunjucks/runtime';
import { createHtmlContextTracker, type HtmlContext } from '@nunjucks/shared';
import {
  fail as failCompiler,
  getTemplateName as getCompilerTemplateName,
  pushBuffer as pushCompilerBuffer,
  tmpid as nextCompilerId,
} from './codegen.ts';
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
  fail: (msg: string, lineno?: number, colno?: number) => void;
  tmpid: () => string;
  getTemplateName: () => string;
  compileChildren: (node: Node, frame: Frame) => void;
  compileExpression: (node: Node, frame: Frame) => void;
  assertType: (node: Node, ...types: NodeTypeMatcher[]) => void;
  compile: (node: Node, frame: Frame) => void;
  getHtmlContext: (lineno: number, colno: number) => HtmlContext;
}

export const createCompiler = (
  templateName: string | null,
  undefinedMode: UndefinedMode | undefined,
  source: string
): Compiler => {
  const contextTracker = createHtmlContextTracker(source);

  const compiler: Compiler = {
    templateName,
    codebuf: [],
    lastId: 0,
    buffer: null,
    bufferStack: [],
    scopeStack: [],
    inBlock: false,
    undefinedMode: undefinedMode ?? DEFAULT_UNDEFINED_MODE,
    compiledLine: 0,

    fail(msg, lineno, colno) {
      failCompiler(compiler, msg, lineno, colno);
    },
    pushBuffer() {
      return pushCompilerBuffer(compiler);
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
      forEach(lines, line => compiler.emitLine(line));
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
    tmpid() {
      return nextCompilerId(compiler);
    },
    getTemplateName() {
      return getCompilerTemplateName(compiler);
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
      return compileDispatch(compiler, node, frame);
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
