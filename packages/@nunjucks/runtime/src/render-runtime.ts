import { suppressValue } from './suppress-value.ts';
import { ensureDefined } from './undefined-resolution.ts';
import { awaitValue } from './await-value.ts';
import { callWrap, inOperator } from './call-wrap.ts';
import { contextOrFrameLookup, fromIterator } from './lookups.ts';
import { handleError } from './handle-error.ts';
import {
  memberLookup, optionalMemberLookup, slice, nullishCoalesce,
} from './member-access.ts';
import { isSafeString, markSafe, copySafeness, createSafeString } from './safe-string.ts';
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
      templateName: options.templateName || 'inline',
      phase: 'render' as const,
      renderContext: options.renderContext ?? null,
    },
  } : {}),
});

export { createRenderRuntime };

export type RenderRuntime = ReturnType<typeof createRenderRuntime>;
