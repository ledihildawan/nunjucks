// FACTORY - Node creation
// Import directly: import { node, literal } from '@nunjucks/nodes/factory'

import { T, type Node } from './types.ts';

const cache = new Map<string, readonly string[]>();

const fields = (type: string, data: Record<string, unknown>): readonly string[] => {
  if (!cache.has(type)) cache.set(type, Object.freeze(Object.keys(data)));
  return cache.get(type)!;
};

export const node = (lineno: number, colno: number): Node =>
  Object.freeze({ type: T.NODE, lineno, colno, fields: fields(T.NODE, {}) }) as Node;

export const literal = (lineno: number, colno: number, val: unknown): Node =>
  Object.freeze({ type: T.LITERAL, lineno, colno, value: val, fields: fields(T.LITERAL, { value: val }) }) as Node;

export const symbol = (lineno: number, colno: number, val: string): Node =>
  Object.freeze({ type: T.SYMBOL, lineno, colno, value: val, fields: fields(T.SYMBOL, { value: val }) }) as Node;

export const nodeList = (lineno: number, colno: number, children: Node[] = []): Node =>
  Object.freeze({ type: T.NODE_LIST, lineno, colno, children: Object.freeze([...children]), fields: fields(T.NODE_LIST, { children: [] }) }) as Node;

export const root = (lineno: number, colno: number, children: Node[] = []): Node =>
  Object.freeze({ type: T.ROOT, lineno, colno, children: Object.freeze([...children]), fields: fields(T.ROOT, { children: [] }) }) as Node;

export const output = (lineno: number, colno: number, children: Node[] = []): Node =>
  Object.freeze({ type: T.OUTPUT, lineno, colno, children: Object.freeze([...children]), fields: fields(T.OUTPUT, { children: [] }) }) as Node;

export const templateData = (lineno: number, colno: number, val: string): Node =>
  Object.freeze({ type: T.TEMPLATE_DATA, lineno, colno, value: val, fields: fields(T.TEMPLATE_DATA, { value: val }) }) as Node;

export const funCall = (lineno: number, colno: number, name: string, args: Node[] = []): Node =>
  Object.freeze({ type: T.FUN_CALL, lineno, colno, name, args: Object.freeze([...args]), fields: fields(T.FUN_CALL, { name, args: [] }) }) as Node;

export const pipe = (lineno: number, colno: number, name: string, args: Node[] = []): Node =>
  Object.freeze({ type: T.PIPE, lineno, colno, name, args: Object.freeze([...args]), fields: fields(T.PIPE, { name, args: [] }) }) as Node;

export const lookupVal = (lineno: number, colno: number, target: Node, val: Node): Node =>
  Object.freeze({ type: T.LOOKUP_VAL, lineno, colno, target, val, fields: fields(T.LOOKUP_VAL, { target, val }) }) as Node;

export const slice = (lineno: number, colno: number, start: Node | null, stop: Node | null, step: Node | null): Node =>
  Object.freeze({ type: T.SLICE, lineno, colno, start, stop, step, fields: fields(T.SLICE, { start, stop, step }) }) as Node;

export const add = (lineno: number, colno: number, left: Node, right: Node): Node =>
  Object.freeze({ type: T.ADD, lineno, colno, left, right, operator: '+', fields: fields(T.ADD, { left, right, operator: '+' }) }) as Node;

export const sub = (lineno: number, colno: number, left: Node, right: Node): Node =>
  Object.freeze({ type: T.SUB, lineno, colno, left, right, operator: '-', fields: fields(T.SUB, { left, right, operator: '-' }) }) as Node;

export const mul = (lineno: number, colno: number, left: Node, right: Node): Node =>
  Object.freeze({ type: T.MUL, lineno, colno, left, right, operator: '*', fields: fields(T.MUL, { left, right, operator: '*' }) }) as Node;

export const div = (lineno: number, colno: number, left: Node, right: Node): Node =>
  Object.freeze({ type: T.DIV, lineno, colno, left, right, operator: '/', fields: fields(T.DIV, { left, right, operator: '/' }) }) as Node;

export const and = (lineno: number, colno: number, left: Node, right: Node): Node =>
  Object.freeze({ type: T.AND, lineno, colno, left, right, fields: fields(T.AND, { left, right }) }) as Node;

export const or = (lineno: number, colno: number, left: Node, right: Node): Node =>
  Object.freeze({ type: T.OR, lineno, colno, left, right, fields: fields(T.OR, { left, right }) }) as Node;

export const not = (lineno: number, colno: number, target: Node): Node =>
  Object.freeze({ type: T.NOT, lineno, colno, target, operator: 'not', fields: fields(T.NOT, { target, operator: 'not' }) }) as Node;

export const compare = (lineno: number, colno: number, expr: Node, ops: Node[] = []): Node =>
  Object.freeze({ type: T.COMPARE, lineno, colno, expr, ops: Object.freeze([...ops]), fields: fields(T.COMPARE, { expr, ops: [] }) }) as Node;

export const group = (lineno: number, colno: number, children: Node[] = []): Node =>
  Object.freeze({ type: T.GROUP, lineno, colno, children: Object.freeze([...children]), fields: fields(T.GROUP, { children: [] }) }) as Node;

export const array = (lineno: number, colno: number, children: Node[] = []): Node =>
  Object.freeze({ type: T.ARRAY, lineno, colno, children: Object.freeze([...children]), fields: fields(T.ARRAY, { children: [] }) }) as Node;

export const dict = (lineno: number, colno: number, children: Node[] = []): Node =>
  Object.freeze({ type: T.DICT, lineno, colno, children: Object.freeze([...children]), fields: fields(T.DICT, { children: [] }) }) as Node;

export const pair = (lineno: number, colno: number, key: Node, val: Node): Node =>
  Object.freeze({ type: T.PAIR, lineno, colno, key, value: val, fields: fields(T.PAIR, { key, value: val }) }) as Node;

export const for_ = (lineno: number, colno: number, arr?: Node, name?: string, body?: Node, else_?: Node | null): Node =>
  Object.freeze({ type: T.FOR, lineno, colno, arr, name, body, else_: else_ ?? null, fields: fields(T.FOR, { arr, name, body, else_ }) }) as Node;

export const if_ = (lineno: number, colno: number, cond?: Node, body?: Node, else_?: Node | null): Node =>
  Object.freeze({ type: T.IF, lineno, colno, cond, body, else_: else_ ?? null, fields: fields(T.IF, { cond, body, else_ }) }) as Node;

export const block = (lineno: number, colno: number, name?: string, body?: Node): Node =>
  Object.freeze({ type: T.BLOCK, lineno, colno, name, body, fields: fields(T.BLOCK, { name, body }) }) as Node;

export const set = (lineno: number, colno: number, targets?: Node[], value?: Node, operator?: string | null): Node =>
  Object.freeze({ type: T.SET, lineno, colno, targets: Object.freeze([...(targets ?? [])]), value, operator: operator ?? null, fields: fields(T.SET, { targets: [], value, operator: null }) }) as Node;

export const macro = (lineno: number, colno: number, name: string, args: Node[] = [], body?: Node): Node =>
  Object.freeze({ type: T.MACRO, lineno, colno, name, args: Object.freeze([...args]), body, fields: fields(T.MACRO, { name, args: [], body }) }) as Node;

export const import_ = (lineno: number, colno: number, template: string, target: string, withContext = false): Node =>
  Object.freeze({ type: T.IMPORT, lineno, colno, template, target, withContext, fields: fields(T.IMPORT, { template, target, withContext }) }) as Node;

export const fromImport = (lineno: number, colno: number, template: string, names?: Node, withContext = false): Node =>
  Object.freeze({ type: T.FROM_IMPORT, lineno, colno, template, names: names ?? nodeList(0, 0), withContext, fields: fields(T.FROM_IMPORT, { template, names, withContext }) }) as Node;

export const extends_ = (lineno: number, colno: number, template?: Node): Node =>
  Object.freeze({ type: T.EXTENDS, lineno, colno, template, fields: fields(T.EXTENDS, { template }) }) as Node;

export const include = (lineno: number, colno: number, template?: Node, ignoreMissing?: boolean | null): Node =>
  Object.freeze({ type: T.INCLUDE, lineno, colno, template, ignoreMissing: ignoreMissing ?? null, fields: fields(T.INCLUDE, { template, ignoreMissing: null }) }) as Node;

export const switch_ = (lineno: number, colno: number, expr?: Node, cases?: Node[], default_?: Node | null): Node =>
  Object.freeze({ type: T.SWITCH, lineno, colno, expr, cases: Object.freeze([...(cases ?? [])]), default: default_ ?? null, fields: fields(T.SWITCH, { expr, cases: [], default: null }) }) as Node;

export const tryCatch = (lineno: number, colno: number, body?: Node, catchBody?: Node | null, errVar?: string | null): Node =>
  Object.freeze({ type: T.TRY_CATCH, lineno, colno, body, catch: catchBody ?? null, errVar: errVar ?? null, fields: fields(T.TRY_CATCH, { body, catch: null, errVar: null }) }) as Node;

export const do_ = (lineno: number, colno: number, expr?: Node): Node =>
  Object.freeze({ type: T.DO, lineno, colno, expr, fields: fields(T.DO, { expr }) }) as Node;

export const with_ = (lineno: number, colno: number, assignments?: Node[], body?: Node | null): Node =>
  Object.freeze({ type: T.WITH, lineno, colno, assignments: Object.freeze([...(assignments ?? [])]), body, fields: fields(T.WITH, { assignments: [], body }) }) as Node;

export const callExtension = (ext: unknown, prop: string, args?: Node, contentArgs?: Node[]): Node => {
  const lineno = 0, colno = 0;
  return Object.freeze({
    type: T.CALL_EXTENSION, lineno, colno,
    extName: (ext as { __name?: string })?.__name || String(ext),
    prop,
    args: args ?? nodeList(0, 0),
    contentArgs: Object.freeze([...(contentArgs ?? [])]),
    autoescape: (ext as { autoescape?: boolean })?.autoescape ?? true,
    fields: fields(T.CALL_EXTENSION, { extName: '', prop, args: null, contentArgs: [], autoescape: true })
  }) as Node;
};

export const is = (lineno: number, colno: number, left: Node, right: Node): Node =>
  Object.freeze({ type: T.IS, lineno, colno, left, right, fields: fields(T.IS, { left, right }) }) as Node;

export const in_ = (lineno: number, colno: number, left: Node, right: Node): Node =>
  Object.freeze({ type: T.IN, lineno, colno, left, right, fields: fields(T.IN, { left, right }) }) as Node;

export const spread = (lineno: number, colno: number, argument: Node): Node =>
  Object.freeze({ type: T.SPREAD, lineno, colno, argument, fields: fields(T.SPREAD, { argument }) }) as Node;
