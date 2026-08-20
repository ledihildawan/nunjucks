// WHY: test-only doubles for the statement-compiler suite — single definitions replacing
// the factories each co-located *.test.ts file previously re-declared locally.
// Empty-bodied members (e.g. popBuffer) deliberately return undefined: the doubles must
// stay behavior-identical while remaining lint-clean as a non-test source file.
import { createLog } from '@nunjucks/error-formatter';
import type { Frame } from '@nunjucks/runtime';
import type { FailFields } from '../codegen.ts';
import { makeRecordingCore } from '../test-helpers.ts';

// WHY: mirrors codegen's fail() contract — the double throws a catalogued TemplateError,
// never a raw Error. `lineno: null` routes the payload down createLog's raw-data path so
// the original message passes through unchanged for toThrow assertions.
const throwCataloguedFail = ({ message }: FailFields): never => {
  throw createLog('error', { def: { message, lineno: null } });
};

/** Recording double pre-set to the `output` string buffer. */
export const makeCompileDataCompiler = () => {
  const core = makeRecordingCore();
  return {
    ...core,
    buffer: 'output',
  };
};

/** Recording double for output emission with toggleable `streamErrorRecovery`. */
export const makeCompileOutputCompiler = ({
  streamErrorRecovery = false,
}: {
  streamErrorRecovery?: boolean;
} = {}) => {
  const core = makeRecordingCore();
  const streamCatches: string[] = [];
  return {
    ...core,
    streamCatches,
    buffer: 'output',
    streamErrorRecovery,
    undefinedMode: null,
    compile: (node: { marker?: string }) => {
      core.emitted.push(node.marker ?? 'CHILD');
    },
    getHtmlContext: (lineno: number, colno: number) => `ctx:${lineno}:${colno}`,
    emitStreamCatch: (lineno: number, colno: number) => {
      streamCatches.push(`catch(${lineno},${colno})`);
    },
  };
};

/** Recording double whose `compileExpression` emits each node's `marker`. */
export const makeExecCompiler = () => {
  const core = makeRecordingCore();
  return {
    ...core,
    compileExpression: (node: { marker?: string }) => {
      core.emitted.push(node.marker ?? 'EXPR');
    },
  };
};

/** All-purpose recording double with buffer and scoped-syntax stubs. */
export const makeFullStatementCompiler = () => {
  const core = makeRecordingCore();
  return {
    ...core,
    compile: (node: { marker?: string }) => {
      core.emitted.push(node.marker ?? 'X');
    },
    compileExpression: (node: { marker?: string }) => {
      core.emitted.push(node.marker ?? 'E');
    },
    streamErrorRecovery: false,
    pushBuffer: () => 'buf_1',
    popBuffer: () => undefined,
    withScopedSyntax: (fn: () => void) => fn(),
    getHtmlContext: (lineno: number, colno: number) => `ctx:${lineno}:${colno}`,
  };
};

/** Full-statement double reporting a `"test.html"` template name. */
export const makeExtendsCompiler = () => ({
  ...makeFullStatementCompiler(),
  getTemplateName: () => '"test.html"',
});

/** Recording double whose `compileExpression` stringifies template-name nodes. */
export const makeImportCompiler = () => {
  const core = makeRecordingCore();
  return {
    ...core,
    getTemplateName: () => '"parent"',
    compileExpression: (node: { value?: unknown }) => {
      core.emitted.push(String(node.value ?? 'TPL'));
    },
  };
};

/** Recording double emitting `COND`/`BODY` markers for if branches. */
export const makeIfCompiler = () => {
  const core = makeRecordingCore();
  return {
    ...core,
    compile: () => {
      core.emitted.push('BODY');
    },
    compileExpression: () => {
      core.emitted.push('COND');
    },
    withScopedSyntax: (fn: () => void) => fn(),
  };
};

/** Full-statement double whose `fail` throws catalogued errors. */
export const makeFailingStatementCompiler = () => {
  const compiler = makeFullStatementCompiler();
  return {
    ...compiler,
    fail: throwCataloguedFail,
  };
};

/** Full-statement double tracking emitted `func:`/`end` markers. */
export const makeRootCompiler = () => {
  const compiler = makeFullStatementCompiler();
  return {
    ...compiler,
    emitFuncBegin: (_node: unknown, name: string) => {
      compiler.emitted.push(`func:${name} `);
    },
    emitFuncEnd: () => {
      compiler.emitted.push('end ');
    },
    inBlock: false,
  };
};

/** Recording double emitting `VAL`/`BODY` markers for scope tests. */
export const makeScopeCompiler = () => {
  const core = makeRecordingCore();
  return {
    ...core,
    compile: (node: { marker?: string }) => {
      core.emitted.push(node.marker ?? 'BODY');
    },
    compileExpression: (node: { marker?: string }) => {
      core.emitted.push(node.marker ?? 'VAL');
    },
    withScopedSyntax: (fn: () => void) => fn(),
  };
};

/** Recording double emitting node markers with scoped-syntax passthrough. */
export const makeSwitchCompiler = () => {
  const core = makeRecordingCore();
  return {
    ...core,
    compile: (node: { marker?: string }) => {
      core.emitted.push(node.marker ?? 'X');
    },
    withScopedSyntax: (fn: () => void) => fn(),
  };
};

/** Recording double emitting `V`/`X` markers with catalogued `fail`. */
export const makeVariableCompiler = () => {
  const core = makeRecordingCore();
  return {
    ...core,
    compile: (node: { marker?: string }) => {
      core.emitted.push(node.marker ?? 'X');
    },
    compileExpression: (node: { marker?: string }) => {
      core.emitted.push(node.marker ?? 'V');
    },
    fail: throwCataloguedFail,
  };
};

/** Recording double tracking the buffer value each `compile` observed. */
export const makeCaptureCompiler = () => {
  const core = makeRecordingCore();
  const bufferAtCompile: string[] = [];
  let buffer = 'main';
  return {
    ...core,
    bufferAtCompile,
    get buffer() {
      return buffer;
    },
    set buffer(nextBuffer: string) {
      buffer = nextBuffer;
    },
    compile: (node: { marker?: string }) => {
      bufferAtCompile.push(buffer);
      core.emitted.push(node.marker ?? 'BODY');
    },
    withScopedSyntax: (fn: () => void) => fn(),
  };
};

/** Recording double tracking the compile-time frame each compile call observed. */
export const makeFrameTrackingCompiler = () => {
  const core = makeRecordingCore();
  const frames: Frame[] = [];
  return {
    ...core,
    frames,
    compile: (node: { marker?: string }, frame: Frame) => {
      frames.push(frame);
      core.emitted.push(node.marker ?? 'X');
    },
    compileExpression: (node: { marker?: string }, frame: Frame) => {
      frames.push(frame);
      core.emitted.push(node.marker ?? 'VAL');
    },
    withScopedSyntax: (fn: () => void) => fn(),
  };
};
