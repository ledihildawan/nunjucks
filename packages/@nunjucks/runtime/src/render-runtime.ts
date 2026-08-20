import { collectString, fromIterator } from '@nunjucks/lib';
import { WARNINGS_CONTEXT_KEY } from '@nunjucks/shared';
import { keys } from 'remeda';
import { awaitValue } from './await-value.ts';
import { runTest } from './builtin-predicates.ts';
import { callWrap, inOperator } from './call-wrap.ts';
import { createComponent, createComponentContext, createKeywordArgs } from './component.ts';
import { runFilter } from './filter-runtime.ts';
import { createFrame } from './frame.ts';
import { handleError } from './handle-error.ts';
import { contextOrFrameLookup } from './lookups.ts';
import {
  isAbsentLookupResult,
  memberLookup,
  optionalMemberLookup,
  slice,
} from './member-access.ts';
import { createSafeString, markSafe } from './runtime-contract/safe-string.ts';
import { emitUndefinedWarning } from './shell/warning-emitter.ts';
import { createSlotContext } from './slots.ts';
import { streamError } from './stream-error.ts';
import { suppressValue } from './suppress-value.ts';
import { type EnsureDefinedOptions, ensureDefined } from './undefined-resolution.ts';

interface RenderRuntimeOptions {
  templateName?: string;
  renderContext?: unknown;
  // WHY: the caller (core render pipeline) owns the collector array so it can drain
  // warnings for dev-mode injection after the render completes; without this the
  // runtime allocates a private array that no consumer can read.
  warnings?: unknown[];
}

/**
 * Factory for the compiler-emitted runtime contract object — every property on the
 * returned object is exactly what generated code references as `runtime.<name>`.
 * `isSafeString` and `copySafeness` are never emitted by the compiler (verified
 * against compiler/src) and are therefore kept off this object; their
 * implementations remain exported via the package barrel for first-party consumers.
 *
 * @param options - Optional runtime config carrying `templateName`, `renderContext`,
 *   and a `warnings` collector array that the core render pipeline drains for
 *   dev-mode injection after render completes.
 * @returns The runtime contract object passed to compiler-generated template code.
 */
// WHY: composition-root wiring — undefined-rules takes its warning emitter as an
// injectable dependency (no-op default) so pure undefined-mode logic never reaches
// the console; the shell's collector/console emitter is bound exactly here, where
// the runtime contract object handed to compiled code is assembled.
const runtimeEnsureDefined = function (
  this: unknown,
  value: unknown,
  options?: EnsureDefinedOptions
): unknown {
  return ensureDefined.call(this, value, { ...options, emitWarning: emitUndefinedWarning });
};

const createRenderRuntime = (options?: RenderRuntimeOptions) => ({
  suppressValue,
  awaitValue,
  handleError,
  streamError,
  collectString,
  contextOrFrameLookup,
  memberLookup,
  optionalMemberLookup,
  slice,
  // WHY: truthiness for control flow — miss sentinels are callable objects (so optional
  // `obj.missing()` can yield undefined) but must behave FALSY in conditions, mirroring
  // classic nunjucks; raw JS truthiness would take the wrong branch.
  isTruthy: (value: unknown): boolean => !isAbsentLookupResult(value) && Boolean(value),
  inOperator,
  fromIterator,
  callWrap,
  ensureDefined: runtimeEnsureDefined,
  markSafe,
  createFrame,
  createSafeString,
  // WHY: property names are the compiler-emitted contract (generated code calls runtime.makeKeywordArgs / runtime.makeComponent), so they intentionally keep the make* verbs.
  makeKeywordArgs: createKeywordArgs,
  makeComponent: createComponent,
  createSlotContext,
  createComponentContext,
  keys,
  runTest,
  runFilter,
  ...(options
    ? {
        [WARNINGS_CONTEXT_KEY]: options.warnings ?? ([] as unknown[]),
        logContext: {
          templateName: options.templateName ?? 'inline',
          phase: 'render' as const,
          renderContext: options.renderContext ?? null,
        },
      }
    : {}),
});

export { createRenderRuntime };

/** The compiler-emitted runtime contract object returned by `createRenderRuntime`. */
export type RenderRuntime = ReturnType<typeof createRenderRuntime>;
