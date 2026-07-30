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

const createRuntimeWithContext = (templatePath: string | undefined, renderContext: unknown = null): RuntimeContext => ({
  createFrame,
  createSafeString: createSafeString as RuntimeContext['createSafeString'],
  copySafeness: copySafeness as RuntimeContext['copySafeness'],
  markSafe: markSafe as RuntimeContext['markSafe'],
  makeMacro,
  makeKeywordArgs,
  memberLookup,
  optionalMemberLookup: optionalMemberLookup as RuntimeContext['optionalMemberLookup'],
  slice: slice as RuntimeContext['slice'],
  nullishCoalesce,
  suppressValue: suppressValue as RuntimeContext['suppressValue'],
  awaitValue,
  ensureDefined: ensureDefined as RuntimeContext['ensureDefined'],
  callWrap,
  contextOrFrameLookup,
  handleError: handleError as RuntimeContext['handleError'],
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
