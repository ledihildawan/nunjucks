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
import { createSlotContext } from './slots.ts';
import { streamError } from './stream-error.ts';
import { suppressValue } from './suppress-value.ts';
import { ensureDefined } from './undefined-resolution.ts';

interface RenderRuntimeOptions {
  templateName?: string;
  renderContext?: unknown;
}

// WHY: this object is the compiler-emitted contract surface — every property must be exactly
// what generated code references as runtime.<name>. nullishCoalesce, isSafeString, and
// copySafeness are never emitted by the compiler (verified against compiler/src) and are
// therefore kept OFF the object; their implementations remain exported via the package
// barrel (@nunjucks/runtime index) for first-party consumers.
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
  ensureDefined,
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
        [WARNINGS_CONTEXT_KEY]: [] as unknown[],
        logContext: {
          templateName: options.templateName ?? 'inline',
          phase: 'render' as const,
          renderContext: options.renderContext ?? null,
        },
      }
    : {}),
});

export { createRenderRuntime };

export type RenderRuntime = ReturnType<typeof createRenderRuntime>;
