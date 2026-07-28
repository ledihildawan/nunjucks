import {
  createFrame,
  createSafeString,
  copySafeness,
  markSafe,
  makeMacro,
  makeKeywordArgs,
  memberLookup,
  optionalMemberLookup,
  slice,
  nullishCoalesce,
  suppressValue,
  awaitValue,
  ensureDefined,
  callWrap,
  contextOrFrameLookup,
  handleError,
  fromIterator,
  inOperator,
} from '@nunjucks/runtime';
import { isArray, keys } from 'remeda';

export { createRuntimeWithContext };

import type { RuntimeContext } from './runtime-context.js';

const createRuntimeWithContext = (templatePath: string | undefined, _envOpts: Record<string, unknown>, renderContext: unknown = null): RuntimeContext => ({
  createFrame,
  createSafeString,
  copySafeness,
  markSafe,
  makeMacro,
  makeKeywordArgs,
  memberLookup,
  optionalMemberLookup,
  slice,
  nullishCoalesce,
  suppressValue,
  awaitValue,
  ensureDefined,
  callWrap,
  contextOrFrameLookup,
  handleError,
  fromIterator,
  inOperator,
  isArray,
  keys,
  __warnings__: [],
  logContext: {
    templateName: templatePath || 'inline',
    phase: 'render',
    renderContext
  }
});
