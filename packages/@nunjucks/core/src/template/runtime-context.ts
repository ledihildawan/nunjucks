import type { Frame, SafeString, Macro, KeywordArgs, MemberLookup, Slice, NullishCoalesce, SuppressValue, AwaitValue, EnsureDefined, CallWrap, ContextOrFrameLookup, HandleError, FromIterator, InOperator } from '@nunjucks/runtime';
import type { isArray, keys } from 'remeda';

interface RuntimeContext {
  createFrame: () => Frame;
  createSafeString: (str: unknown) => SafeString;
  copySafeness: (safe: SafeString, str: string) => string;
  markSafe: (str: SafeString) => SafeString;
  makeMacro: (...args: unknown[]) => Macro;
  makeKeywordArgs: (dict: Record<string, unknown>) => KeywordArgs;
  memberLookup: MemberLookup;
  optionalMemberLookup: MemberLookup;
  slice: Slice;
  nullishCoalesce: NullishCoalesce;
  suppressValue: SuppressValue;
  awaitValue: AwaitValue;
  ensureDefined: EnsureDefined;
  callWrap: CallWrap;
  contextOrFrameLookup: ContextOrFrameLookup;
  handleError: HandleError;
  fromIterator: FromIterator;
  inOperator: InOperator;
  isArray: typeof isArray;
  keys: typeof keys;
  __warnings__: unknown[];
  logContext: {
    templateName: string;
    phase: string;
    renderContext: unknown;
  };
}

export type { RuntimeContext };
