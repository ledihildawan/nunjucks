// WHY: test-only helpers — never exported via the package barrel; they give co-located
// *.test.ts files single definitions of the compiler fixtures each test previously
// re-declared locally. Per-variant factories live in test-helpers.ts next to their suites.
// These are SANCTIONED engine test seams, not policy violations: they are hand-rolled
// recording sinks over the local `Compiler` shape (no mocking framework, no infrastructure
// doubles — the rule bans mocking I/O in core tests, not data fixtures of an engine type).
import { createCompiler, type Compiler } from './create-compiler.ts';

/** Casts an externally built compiler object to `Compiler` for test wiring. */
export const asCompiler = (compiler: unknown): Compiler => compiler as Compiler;

/** Sink collecting everything test doubles emit, plus id/emit helpers sharing it. */
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

/** Builds a real compiler with `undefinedMode` left to its default. */
export const makeCodegenCompiler = () =>
  createCompiler({ templateName: 'test', undefinedMode: undefined, source: '' });

// WHY: explicit chainable twin of makeCodegenCompiler — create-compiler normalizes
// `undefined` to DEFAULT_UNDEFINED_MODE ('chainable'), so both are behavior-identical;
// this variant keeps the mode visible at call sites that assert chainable codegen.
/** Builds a compiler whose `undefinedMode` is explicitly `'chainable'`. */
export const makeChainableCompiler = () =>
  createCompiler({ templateName: 'test', undefinedMode: 'chainable', source: '' });
