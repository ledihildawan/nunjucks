import type { Node } from '@nunjucks/nodes';
import {
  isOptionalCall,
  isOptionalChain,
  isPipe,
  isTemplateData,
  isVariableAssignment,
  isVariableDeclaration,
} from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { type Loc, loc } from '@nunjucks/shared';
import { appendTarget } from '../codegen.ts';
import type { Compiler } from '../create-compiler.ts';
import { extractPropertyLocation } from '../location-utils.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';
import { extractVarName } from './extract-var-name.ts';

interface EmitEnsureDefinedCloseInput {
  child: Node;
  nodeLoc: Loc;
}

const emitEnsureDefinedClose = (
  compiler: Compiler,
  { child, nodeLoc }: EmitEnsureDefinedCloseInput
): void => {
  const name = extractVarName(child);
  const nameProp = name ? `, varName: ${JSON.stringify(name)}` : '';
  const modeProp = compiler.undefinedMode
    ? `, undefinedMode: ${JSON.stringify(compiler.undefinedMode)}`
    : '';
  compiler.emit(`, { lineno: ${nodeLoc.lineno}, colno: ${nodeLoc.colno}${nameProp}${modeProp} })`);
};

const isVariableLike = (child: Node): boolean =>
  isVariableDeclaration(child) || isVariableAssignment(child);

// WHY: "root scope" = the lexical scope where `parentTemplate` lives (direct root
// children, not inside a block function or a buffered capture/slot/component body).
const isRootOutputSuppressed = (compiler: Compiler): boolean =>
  compiler.suppressRootOutput && !compiler.inBlock && compiler.buffer === null;

const compileTemplateDataChild = (compiler: Compiler, child: Node): void => {
  if (child.value) {
    compiler.emit(appendTarget(compiler));
    compiler.emit(JSON.stringify(child.value));
    compiler.emit(';');
  }
};

const compileOutputChild = (compiler: Compiler, child: Node, frame: Frame): void => {
  const isPipeType = isPipe(child);
  const isOptional = isOptionalChain(child) || isOptionalCall(child);
  const childLoc = loc(extractPropertyLocation(child));
  const { lineno, colno } = childLoc;
  // WHY: pipes are deliberately OUTSIDE the strict-undefined boundary — a filter's
  // contract owns its input (e.g. `fallback` exists precisely to absorb undefined),
  // and by the time a filter returns, a miss has been normalized to a valid value.
  // Strict + pipe composes via `{{ a.b }}` without the filter, or `|> fallback(...)`.
  const useEnsureDefined = !isPipeType && (!isOptional || compiler.undefinedMode === 'debug');
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
    emitEnsureDefinedClose(compiler, { child, nodeLoc: childLoc });
  }
  if (!isPipeType) {
    compiler.emit(')');
  }
  compiler.emit(
    `, { autoescape: env.opts.autoescape, lineno, colno, context: ${JSON.stringify(htmlContext)} });`
  );
  if (compiler.streamErrorRecovery) {
    compiler.emitStreamCatch(lineno, colno);
  }
};

const processOutputChild = (compiler: Compiler, child: Node, frame: Frame): void => {
  if (isTemplateData(child)) {
    if (!isRootOutputSuppressed(compiler)) {
      compileTemplateDataChild(compiler, child);
    }
    return;
  }
  if (isVariableLike(child)) {
    if (compiler.streamErrorRecovery) {
      // WHY: walrus operator (:=) and variable declarations bypass compileOutputChild (which has the boundary). Wrap them so a failed expression evaluation (e.g. {{ x := missing.deep }}) produces an inline marker instead of killing the generator. The frame.set is never reached, so the variable stays undefined — subsequent {{ x }} hits its own output boundary.
      const { lineno: walrusLineno, colno: walrusColno } = loc(extractPropertyLocation(child));
      // WHY: emitStreamCatch closes the try { opened below — compiler.compile MUST NOT emit intervening top-level statements between the open and close (the try/catch balance is implicit). The generated code reads: `lineno=X; colno=Y; try { <declaration> } catch(e) { yield streamError }`.
      compiler.emitLine(`lineno = ${walrusLineno}; colno = ${walrusColno}; try {`);
      compiler.compile(child, frame);
      compiler.emitStreamCatch(walrusLineno, walrusColno);
    } else {
      compiler.compile(child, frame);
    }
    return;
  }
  // WHY: root-scope {{ expr }} output is dropped under extends (the parent renders the
  // page); block bodies (inBlock) and buffered contexts (capture/slot/component —
  // buffer !== null) run at call time where parentTemplate is irrelevant, so they keep
  // compiling. Walrus above still emits for its assignment side effect.
  if (isRootOutputSuppressed(compiler)) {
    return;
  }
  compileOutputChild(compiler, child, frame);
};

/**
 * Compiles an output node's `{{ }}` children in order, routing static text,
 * variable-like children, and expressions through `processOutputChild`'s
 * dedicated suppression/boundary rules.
 */
export const compileOutput = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<Node>
): void => {
  for (const child of node.children ?? []) {
    processOutputChild(compiler, child, frame);
  }
  compiler.emit('\n');
};
