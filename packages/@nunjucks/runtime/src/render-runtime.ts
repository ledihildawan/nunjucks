import { collectString } from '@nunjucks/lib/collect-stream';
import { fromIterator } from '@nunjucks/lib/from-iterator';
import { nullishCoalesce } from '@nunjucks/lib/nullish-coalesce';
import { keys } from 'remeda';
import { awaitValue } from './await-value.ts';
import { runTest } from './builtin-predicates.ts';
import { callWrap, inOperator } from './call-wrap.ts';
import { createComponent, createComponentContext, createKeywordArgs } from './component.ts';
import { runFilter } from './filter-runtime.ts';
import { createFrame } from './frame.ts';
import { handleError } from './handle-error.ts';
import { contextOrFrameLookup } from './lookups.ts';
import { memberLookup, optionalMemberLookup, slice } from './member-access.ts';
import {
  copySafeness,
  createSafeString,
  isSafeString,
  markSafe,
} from './runtime-contract/safe-string.ts';
import { createSlotContext } from './slots.ts';
import { streamError } from './stream-error.ts';
import { suppressValue } from './suppress-value.ts';
import { ensureDefined } from './undefined-resolution.ts';

interface RenderRuntimeOptions {
  templateName?: string;
  renderContext?: unknown;
}

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
  nullishCoalesce,
  inOperator,
  fromIterator,
  callWrap,
  ensureDefined,
  isSafeString,
  markSafe,
  copySafeness,
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
        __warnings__: [] as unknown[],
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
