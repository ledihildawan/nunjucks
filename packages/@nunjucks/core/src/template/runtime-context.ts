import type { Frame, SafeString } from '@nunjucks/runtime';
import type { isArray, keys } from 'remeda';

interface RuntimeContext {
  createFrame: () => Frame;
  createSafeString: (str: unknown) => SafeString;
  copySafeness: (safe: SafeString, str: string) => string;
  markSafe: (str: SafeString) => SafeString;
  makeMacro: (argNames: string[], kwargNames: string[], func: (...args: unknown[]) => unknown) => (...macroArgs: unknown[]) => unknown;
  makeKeywordArgs: <T>(obj: T) => T & { keywords: boolean };
  memberLookup: (obj: unknown, val: string, parentName: string | null) => unknown;
  optionalMemberLookup: (obj: unknown, val: string | symbol, parentName: string | null) => unknown;
  slice: (arr: unknown, start: number | null, stop: number | null, step: number | null) => unknown;
  nullishCoalesce: (val: unknown, fallback: unknown) => unknown;
  suppressValue: (val: unknown, autoescape?: boolean, lineno?: number | null, colno?: number | null) => string;
  awaitValue: (val: unknown) => unknown;
  ensureDefined: (val: unknown, name?: string | null, lineno?: number | null, colno?: number | null, templateName?: string | null, undefinedMode?: 'chainable' | 'strict' | 'debug') => unknown;
  callWrap: (obj: unknown, name: string, displayName: string | null, context: unknown, args: unknown[], lineno?: number, colno?: number) => unknown;
  contextOrFrameLookup: (context: { lookup: (name: string) => unknown }, frame: { lookup: (name: string) => unknown }, name: string) => unknown;
  handleError: (err: unknown, lineno?: number | null, colno?: number | null, templateName?: string | null) => never;
  fromIterator: (arr: unknown) => unknown;
  inOperator: (key: unknown, val: unknown, lineno?: number | null, colno?: number | null) => boolean;
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
