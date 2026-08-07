import type { Frame, SafeString } from '@nunjucks/runtime';
import type { makeKeywordArgs, makeComponent } from '@nunjucks/runtime';
import type { keys } from 'remeda';

interface RuntimeContext {
  createFrame: () => Frame;
  createSafeString: (str: unknown) => SafeString;
  copySafeness: (safe: SafeString, str: string) => string;
  isSafeString: (value: unknown) => value is SafeString;
  markSafe: (str: SafeString) => SafeString;
  makeComponent: typeof makeComponent;
  makeKeywordArgs: typeof makeKeywordArgs;
  memberLookup: (obj: unknown, value: string, parentName: string | null) => unknown;
  optionalMemberLookup: (obj: unknown, value: string | symbol, parentName: string | null) => unknown;
  slice: (arr: unknown, start: number | null, stop: number | null, step: number | null) => unknown;
  nullishCoalesce: (value: unknown, fallback: unknown) => unknown;
  suppressValue: (value: unknown, autoescape?: boolean, lineno?: number | null, colno?: number | null) => string;
  awaitValue: (value: unknown) => unknown;
  ensureDefined: (value: unknown, lineno?: number | null, colno?: number | null, varName?: string | null, templateName?: string | null, undefinedMode?: 'chainable' | 'strict' | 'debug') => unknown;
  callWrap: (obj: unknown, name: string, displayName: string | null, context: unknown, args: unknown[], lineno?: number, colno?: number) => unknown;
  contextOrFrameLookup: (context: { lookup: (name: string) => unknown }, frame: { lookup: (name: string) => unknown }, name: string) => unknown;
  handleError: (err: unknown, lineno?: number | null, colno?: number | null, templateName?: string | null) => never;
  fromIterator: (arr: unknown) => unknown;
  inOperator: (key: unknown, value: unknown, lineno?: number | null, colno?: number | null) => boolean;
  runTest: (env: unknown, name: string, target: unknown, ...args: unknown[]) => boolean;
  keys: typeof keys;
  __warnings__: unknown[];
  logContext: {
    templateName: string;
    phase: string;
    renderContext: unknown;
  };
}

export type { RuntimeContext };
