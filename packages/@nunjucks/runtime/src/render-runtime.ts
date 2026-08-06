// Single source of truth for the `runtime.X(...)` helpers called by compiled
// template code. Imports sibling modules directly (not via ./index.ts) to avoid
// a barrel self-cycle.
import { suppressValue } from './suppress-value.ts';
import { ensureDefined } from './undefined-resolution.ts';
import { awaitValue } from './await-value.ts';
import {
  callWrap, contextOrFrameLookup, handleError, fromIterator, inOperator,
} from './runtime-helpers.ts';
import {
  memberLookup, optionalMemberLookup, slice, nullishCoalesce,
} from './member-access.ts';
import { isSafeString, markSafe, copySafeness, createSafeString } from './safe-string.ts';
import { createFrame } from './frame.ts';
import { makeKeywordArgs, makeComponent, createComponentContext } from './component.ts';
import { createSlotContext } from './slots.ts';
import { runTest } from './builtin-predicates.ts';
import { keys } from 'remeda';

interface RenderRuntimeOptions {
  templateName?: string;
  renderContext?: unknown;
}

/**
 * Build the runtime helper object that compiled template code receives as
 * its 4th parameter: `root(env, context, frame, runtime)`.
 *
 * When `options.templateName` is provided, `__warnings__` and `logContext`
 * are included (for dev-mode warning collection). Without options, the
 * object is still fully functional — just without debug metadata.
 */
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
export type { RenderRuntimeOptions };

export type RenderRuntime = ReturnType<typeof createRenderRuntime>;
