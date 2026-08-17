// WHY: test-only doubles for the statement-compiler suite — single definitions replacing
// the factories each co-located *.test.ts file previously re-declared locally.
// Empty-bodied members (e.g. popBuffer) deliberately return undefined: the doubles must
// stay behavior-identical while remaining lint-clean as a non-test source file.
import { createLog } from '@nunjucks/error-formatter';
import type { FailFields } from '../codegen.ts';
import { makeRecordingCore } from '../test-helpers.ts';

// WHY: mirrors codegen's fail() contract — the double throws a catalogued TemplateError,
// never a raw Error. `lineno: null` routes the payload down createLog's raw-data path so
// the original message passes through unchanged for toThrow assertions.
const throwCataloguedFail = ({ message }: FailFields): never => {
  throw createLog('error', { def: { message, lineno: null } });
};

export const makeCompileDataCompiler = () => {
  const core = makeRecordingCore();
  return {
    ...core,
    buffer: 'output',
  };
};

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

export const makeExecCompiler = () => {
  const core = makeRecordingCore();
  return {
    ...core,
    compileExpression: (node: { marker?: string }) => {
      core.emitted.push(node.marker ?? 'EXPR');
    },
  };
};

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
  };
};

export const makeExtendsCompiler = () => ({
  ...makeFullStatementCompiler(),
  getTemplateName: () => '"test.html"',
});

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

export const makeFailingStatementCompiler = () => {
  const compiler = makeFullStatementCompiler();
  return {
    ...compiler,
    fail: throwCataloguedFail,
  };
};

export const makeRootCompiler = () => {
  const compiler = makeFullStatementCompiler();
  return {
    ...compiler,
    emitFuncBegin: (_node: unknown, name: string) => {
      compiler.emitted.push(`func:${name} `);
    },
    emitFuncEnd: (_isGenerator?: boolean) => {
      compiler.emitted.push('end ');
    },
    inBlock: false,
  };
};

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
