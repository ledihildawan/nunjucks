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
import { appendTarget } from '../../codegen.ts';
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
    compiler.emit(appendTarget(compiler));
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

  // WHY: when streamErrorRecovery is enabled, each output expression gets its own try/catch so a failing {{ expr }} yields an inline error marker (via runtime.streamError) instead of terminating the entire async generator. Static text and subsequent expressions continue to stream.
  const prefix = compiler.streamErrorRecovery
    ? `lineno = ${lineno}; colno = ${colno}; try { ${appendTarget(compiler)}runtime.suppressValue(`
    : `lineno = ${lineno}; colno = ${colno}; ${appendTarget(compiler)}runtime.suppressValue(`;
  compiler.emitLine(prefix);
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
  if (compiler.streamErrorRecovery) {
    compiler.emitLine('} catch (e) { yield runtime.streamError(e, { lineno, colno }); }');
  }
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
    if (compiler.streamErrorRecovery) {
      // WHY: walrus operator (:=) and variable declarations bypass compileOutputChild (which has the boundary). Wrap them so a failed expression evaluation (e.g. {{ x := missing.deep }}) produces an inline marker instead of killing the generator. The frame.set is never reached, so the variable stays undefined — subsequent {{ x }} hits its own output boundary.
      const { lineno: rawLine, colno: rawColumn } = extractPropertyLocation(child);
      const walrusLineno = rawLine ?? 0;
      const walrusColno = rawColumn ?? 0;
      compiler.emitLine(`lineno = ${walrusLineno}; colno = ${walrusColno}; try {`);
      compiler.compile(child, frame);
      compiler.emitLine('} catch (e) { yield runtime.streamError(e, { lineno, colno }); }');
    } else {
      compiler.compile(child, frame);
    }
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
