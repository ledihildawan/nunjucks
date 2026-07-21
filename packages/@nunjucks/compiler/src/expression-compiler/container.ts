import { nodes } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';

const STRING_ESCAPE_MAP: Record<string, string> = {
  '\\': '\\\\',
  '"': '\\"',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
  '\u2028': '\\u2028',
};

const TEMPLATE_ESCAPE_MAP: Record<string, string> = {
  '\\': '\\\\',
  '`': '\\`',
  '$': '\\$',
};

const escapeString = (str: string): string => {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i]!;
    result += STRING_ESCAPE_MAP[char] ?? char;
  }
  return result;
};

export const compileLiteral = (ctx: Compiler, node: Node): void => {
  if (typeof node.value === 'string') {
    const val = escapeString(node.value);
    ctx._emit(`"${val}"`);
  } else if (node.value === null) {
    ctx._emit('null');
  } else {
    ctx._emit((node.value as { toString(): string }).toString());
  }
};

export const compileSymbol = (ctx: Compiler, node: Node, frame: Frame): void => {
  const name = node.value as string;
  const v = frame.lookup(name);

  if (v) {
    ctx._emit(v as string);
  } else {
    ctx._emit('runtime.contextOrFrameLookup(' +
      'context, frame, "' + name + '")');
  }
};

export const compileGroup = (ctx: Compiler, node: Node, frame: Frame): void => {
  compileAggregate(ctx, node, frame, '(', ')');
};

export const compileArray = (ctx: Compiler, node: Node, frame: Frame): void => {
  compileAggregate(ctx, node, frame, '[', ']');
};

export const compileDict = (ctx: Compiler, node: Node, frame: Frame): void => {
  compileAggregate(ctx, node, frame, '{', '}');
};

export const compileNodeList = (ctx: Compiler, node: Node, frame: Frame): void => {
  ctx._compileChildren(node, frame);
};

export const compilePair = (ctx: Compiler, node: Node, frame: Frame): void => {
  let key = node.key as Node;
  const val = node.value as Node;

  if (nodes.isSymbol(key)) {
    key = nodes.literal(key.lineno, key.colno, key.value);
  } else if (!(nodes.isLiteral(key) &&
    typeof key.value === 'string')) {
    ctx.fail('compilePair: Dict keys must be strings or names',
      key.lineno,
      key.colno);
  }

  ctx.compile(key, frame);
  ctx._emit(': ');
  ctx._compileExpression(val, frame);
};

export const compileKeywordArgs = (ctx: Compiler, node: Node, frame: Frame): void => {
  ctx._emit('runtime.makeKeywordArgs(');
  compileDict(ctx, node, frame);
  ctx._emit(')');
};

export const compileSpread = (ctx: Compiler, node: Node, frame: Frame): void => {
  ctx._emit('...');
  ctx.compile(node.argument as Node, frame);
};

const escapeTemplateString = (str: string): string => {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i]!;
    result += TEMPLATE_ESCAPE_MAP[char] ?? char;
  }
  return result;
};

export const compileTemplateLiteral = (ctx: Compiler, node: Node, frame: Frame): void => {
  const rawQuasis = (node.quasis as { quasis?: unknown[] } | unknown[] | undefined);
  const quasis = (Array.isArray(rawQuasis) ? rawQuasis : (rawQuasis && (rawQuasis as { quasis?: unknown[] }).quasis)) || [];
  ctx._emit('`');

  for (const quasi of quasis) {
    const q = quasi as Node & { value?: string };
    if (q.type === 'template') {
      ctx._emit(escapeTemplateString(q.value as string));
    } else if (q.type === 'expression') {
      ctx._emit('${');
      ctx.compile(q.node as Node, frame);
      ctx._emit('}');
    }
  }

  ctx._emit('`');
};

export const compileAggregate = (ctx: Compiler, node: Node, frame: Frame, startChar?: string, endChar?: string): void => {
  if (startChar) {
    ctx._emit(startChar);
  }

  node.children!.forEach((child, i) => {
    if (i > 0) {
      ctx._emit(',');
    }
    if (nodes.isSpread(child)) {
      ctx._emit('...');
      ctx.compile(child.argument as Node, frame);
    } else {
      ctx.compile(child, frame);
    }
  });

  if (endChar) {
    ctx._emit(endChar);
  }
};
