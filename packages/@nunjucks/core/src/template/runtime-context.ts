import type { Frame, SafeString } from '@nunjucks/runtime';
import type { makeKeywordArgs, makeComponent } from '@nunjucks/runtime';
import type { SuppressValueOptions, EnsureDefinedOptions, CallWrapOptions, InOperatorOptions } from '@nunjucks/runtime';
import type { Phase } from '@nunjucks/shared';
import type { keys } from 'remeda';

interface RuntimeContext {
  createFrame: () => Frame;
  createSafeString: (str: unknown) => SafeString;
  copySafeness: (safe: SafeString, str: string) => string;
  isSafeString: (value: unknown) => value is SafeString;
  markSafe: (str: SafeString) => SafeString;
  makeComponent: typeof makeComponent;
  makeKeywordArgs: typeof makeKeywordArgs;
  memberLookup: (target: unknown, value: string, parentName: string | null) => unknown;
  optionalMemberLookup: (target: unknown, value: string | symbol, parentName: string | null) => unknown;
  slice: (source: unknown, start: number | null, stop: number | null, step: number | null) => unknown;
  nullishCoalesce: (value: unknown, fallback: unknown) => unknown;
  suppressValue: (value: unknown, options?: SuppressValueOptions) => unknown;
  awaitValue: (value: unknown) => unknown;
  ensureDefined: (value: unknown, options?: EnsureDefinedOptions) => unknown;
  callWrap: (target: unknown, name: string, options: CallWrapOptions) => unknown;
  contextOrFrameLookup: (context: { lookup: (name: string) => unknown }, frame: { lookup: (name: string) => unknown }, name: string) => unknown;
  handleError: (err: unknown, loc: { lineno: number | null; colno: number | null }) => never;
  fromIterator: (iterable: unknown) => unknown;
  inOperator: (input: InOperatorOptions) => boolean;
  runTest: (env: unknown, name: string, target: unknown, ...args: unknown[]) => boolean;
  keys: typeof keys;
  __warnings__: unknown[];
  logContext: {
    templateName: string;
    phase: Phase;
    renderContext: unknown;
  };
}

export type { RuntimeContext };
