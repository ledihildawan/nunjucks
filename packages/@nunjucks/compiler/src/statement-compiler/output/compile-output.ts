import {
  isOptionalCall,
  isOptionalChain,
  isPipe,
  isTemplateData,
  isVariableAssignment,
  isVariableDeclaration,
} from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
import type { Compiler } from '../../index.ts';
import type { CompileNodeInput } from '../../node-dispatch.ts';
import { extractPropertyLocation } from '../../location-utils.ts';
import { extractVarName } from './extract-location.ts';

const emitEnsureDefinedClose = (
  compiler: Compiler,
  child: Node,
  lineno: number,
  colno: number
): void => {
  const name = extractVarName(child);
  const nameProp = name ? `, varName: "${name}"` : '';
  const modeProp = compiler.undefinedMode ? `, undefinedMode: "${compiler.undefinedMode}"` : '';
  compiler.emit(`, { lineno: ${lineno}, colno: ${colno}${nameProp}${modeProp} })`);
};

const isVariableLike = (child: Node): boolean =>
  isVariableDeclaration(child) ||
  isVariableAssignment(child);

const compileTemplateDataChild = (compiler: Compiler, child: Node): void => {
  if (child.value) {
    compiler.emit(`${compiler.buffer} += `);
    compiler.emit(JSON.stringify(child.value));
    compiler.emit(';');
  }
};

const compileOutputChild = (
  compiler: Compiler,
  child: Node,
  frame: Frame
): void => {
  const isPipeType = isPipe(child);
  const isOptional = isOptionalChain(child) || isOptionalCall(child);
  const { lineno: rawLine, colno: rawColumn } = extractPropertyLocation(child);
  const lineno = rawLine ?? 0;
  const colno = rawColumn ?? 0;
  const useEnsureDefined = !isOptional || compiler.undefinedMode === 'debug';
  const htmlContext = compiler.getHtmlContext(lineno, colno);

  compiler.emitLine(`lineno = ${lineno}; colno = ${colno}; ${compiler.buffer} += runtime.suppressValue(`);
  if (!isPipeType) {
    compiler.emit('await runtime.awaitValue(');
  }
  if (useEnsureDefined) {
    compiler.emit('runtime.ensureDefined(');
  }
  compiler.compile(child, frame);
  if (useEnsureDefined) {
    emitEnsureDefinedClose(compiler, child, lineno, colno);
  }
  if (!isPipeType) {
    compiler.emit(')');
  }
  compiler.emit(`, { autoescape: env.opts.autoescape, lineno, colno, context: "${htmlContext}" });`);
};

const processOutputChild = (
  compiler: Compiler,
  child: Node,
  frame: Frame
): void => {
  if (isTemplateData(child)) {
    compileTemplateDataChild(compiler, child);
    return;
  }
  if (isVariableLike(child)) {
    compiler.compile(child, frame);
    return;
  }
  compileOutputChild(compiler, child, frame);
};

export const compileOutput = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<Node>
): void => {
  forEach(node.children ?? [], child => processOutputChild(compiler, child, frame));
  compiler.emit('\n');
};
