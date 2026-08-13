import { suppressValue } from './suppress-value.ts';
import { ensureDefined } from './undefined-resolution.ts';
import { awaitValue } from './await-value.ts';
import { callWrap, inOperator } from './call-wrap.ts';
import { contextOrFrameLookup } from './lookups.ts';
import { fromIterator } from '@nunjucks/lib/from-iterator';
import { handleError } from './handle-error.ts';
import { streamError } from './stream-error.ts';
import { collectString } from '@nunjucks/lib/collect-stream';
import {
  memberLookup, optionalMemberLookup, slice,
} from './member-access.ts';
import { nullishCoalesce } from '@nunjucks/lib/nullish-coalesce';
import { isSafeString, markSafe, copySafeness, createSafeString } from './runtime-contract/safe-string.ts';
import { createFrame } from './frame.ts';
import { makeKeywordArgs, makeComponent, createComponentContext } from './component.ts';
import { createSlotContext } from './slots.ts';
import { runTest } from './builtin-predicates.ts';
import { runFilter } from './filter-runtime.ts';
import { keys } from 'remeda';

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
  makeKeywordArgs,
  makeComponent,
  createSlotContext,
  createComponentContext,
  keys,
  runTest,
  runFilter,
  ...(options ? {
    __warnings__: [] as unknown[],
    logContext: {
      templateName: options.templateName ?? 'inline',
      phase: 'render' as const,
      renderContext: options.renderContext ?? null,
    },
  } : {}),
});

export { createRenderRuntime };

export type RenderRuntime = ReturnType<typeof createRenderRuntime>;
