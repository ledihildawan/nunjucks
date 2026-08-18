// WHY: test-only doubles for the expression-compiler suite — single definitions replacing
// the factories each co-located *.test.ts file previously re-declared locally.
// Empty-bodied members (e.g. assertType) deliberately return undefined: the doubles must
// stay behavior-identical while remaining lint-clean as a non-test source file.
// Sanctioned engine test seam: these are recording sinks over the local Compiler shape,
// not infrastructure mocks — the core no-mock policy targets I/O doubles, not data
// fixtures of the engine's own dispatch contract.
import { createLog } from '@nunjucks/error-formatter';
import type { FailFields } from '../codegen.ts';
import { makeRecordingCore } from '../test-helpers.ts';

// WHY: mirrors codegen's fail() contract — the double throws a catalogued TemplateError,
// never a raw Error. `lineno: null` routes the payload down createLog's raw-data path so
// the original message passes through unchanged for toThrow assertions.
const throwCataloguedFail = ({ message }: FailFields): never => {
  throw createLog('error', { def: { message, lineno: null } });
};

/** Recording double whose `compile` emits each node's `marker` string. */
export const makeMarkerCompiler = () => {
  const core = makeRecordingCore();
  return {
    ...core,
    compile: (node: { marker?: string }) => {
      core.emitted.push(node.marker as string);
    },
  };
};

/** Marker double that also throws catalogued errors from `fail`. */
export const makeInlineCompiler = () => {
  const compiler = makeMarkerCompiler();
  return {
    ...compiler,
    fail: throwCataloguedFail,
  };
};

/** Recording double whose `compile` emits each node's `marker`, defaulting to `X`. */
export const makeIncrementCompiler = () => {
  const core = makeRecordingCore();
  return {
    ...core,
    compile: (node: { marker?: string }) => {
      core.emitted.push(node.marker ?? 'X');
    },
  };
};

/** Recording double whose `compile` and `compileExpression` both emit `X`. */
export const makeFunCallCompiler = () => {
  const core = makeRecordingCore();
  return {
    ...core,
    compile: () => {
      core.emitted.push('X');
    },
    compileExpression: () => {
      core.emitted.push('X');
    },
  };
};

/** Recording double that stringifies literal `value` nodes into quoted strings. */
export const makeLookupCompiler = () => {
  const core = makeRecordingCore();
  const emitNode = (node: { value?: string }) => {
    if (typeof node.value === 'string') {
      core.emitted.push(`"${node.value}"`);
    }
  };
  return {
    ...core,
    compile: emitNode,
    compileExpression: emitNode,
  };
};

/** Recording double with an inert `assertType` accepting any callee name. */
export const makePipeForwardCompiler = () => {
  const core = makeRecordingCore();
  return {
    ...core,
    assertType: () => undefined,
    compile: (node: { marker?: string }) => {
      core.emitted.push(node.marker ?? 'X');
    },
  };
};

/** Recording double for container emitters; `fail` throws catalogued errors. */
export const makeContainerCompiler = () => {
  const core = makeRecordingCore();
  const emitValue = (node: { marker?: string; value?: string; children?: unknown[] }) => {
    if (typeof node.marker === 'string') {
      core.emitted.push(node.marker);
      return;
    }
    if (typeof node.value === 'string') {
      core.emitted.push(`"${node.value}"`);
      return;
    }
    core.emitted.push(String(node.value));
  };
  return {
    ...core,
    compile: emitValue,
    compileExpression: emitValue,
    compileChildren: emitValue,
    fail: throwCataloguedFail,
  };
};
