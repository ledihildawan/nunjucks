// WHY: test-only helpers — never exported via the package barrel; they give co-located
// *.test.ts files single definitions of the compiler fixtures each test previously
// re-declared locally. Per-variant factories live in test-helpers.ts next to their suites.
import { createCompiler, type Compiler } from './create-compiler.ts';

export const asCompiler = (compiler: unknown): Compiler => compiler as Compiler;

export interface RecordingCore {
  emitted: string[];
  emit: (source: string) => void;
  emitLine: (source: string) => void;
  nextCompilerId: () => string;
}

// WHY: shared recording core — every double appends to the same emitted sink; members a
// variant never needed are inert extras that its code-under-test never invokes.
export const makeRecordingCore = (): RecordingCore => {
  const emitted: string[] = [];
  let id = 0;
  return {
    emitted,
    emit: (source: string) => {
      emitted.push(source);
    },
    emitLine: (source: string) => {
      emitted.push(`${source}\n`);
    },
    nextCompilerId: () => {
      id += 1;
      return `t_${id}`;
    },
  };
};

export const makeCodegenCompiler = () =>
  createCompiler({ templateName: 'test', undefinedMode: undefined, source: '' });

// WHY: explicit chainable twin of makeCodegenCompiler — create-compiler normalizes
// `undefined` to DEFAULT_UNDEFINED_MODE ('chainable'), so both are behavior-identical;
// this variant keeps the mode visible at call sites that assert chainable codegen.
export const makeChainableCompiler = () =>
  createCompiler({ templateName: 'test', undefinedMode: 'chainable', source: '' });
