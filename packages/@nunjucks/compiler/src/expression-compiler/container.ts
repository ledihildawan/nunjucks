import { isLiteral, isSpread, isSymbol, literal } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { forEach, reduce } from 'remeda';
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

const escapeString = (str: string): string =>
  reduce([...str], (result, char) => result + (STRING_ESCAPE_MAP[char] ?? char), '');

const compileLiteral = (ctx: Compiler, node: Node): void => {
  if (typeof node.value === 'string') {
    const val = escapeString(node.value);
    ctx.emit(`"${val}"`);
  } else if (node.value === null) {
    ctx.emit('null');
  } else {
    ctx.emit((node.value as { toString: () => string }).toString());
  }
};

const compileSymbol = (ctx: Compiler, node: Node, frame: Frame): void => {
  const name = node.value as string;
  const v = frame.lookup(name);

  if (v) {
    ctx.emit(v as string);
  } else {
    ctx.emit('runtime.contextOrFrameLookup(' +
      'context, frame, "' + name + '")');
  }
};

const compileGroup = (ctx: Compiler, node: Node, frame: Frame): void => {
  compileAggregate(ctx, node, frame, { startChar: '(', endChar: ')' });
};

const compileArray = (ctx: Compiler, node: Node, frame: Frame): void => {
  compileAggregate(ctx, node, frame, { startChar: '[', endChar: ']' });
};

const compileDict = (ctx: Compiler, node: Node, frame: Frame): void => {
  compileAggregate(ctx, node, frame, { startChar: '{', endChar: '}' });
};

const compileNodeList = (ctx: Compiler, node: Node, frame: Frame): void => {
  ctx.compileChildren(node, frame);
};

const compilePair = (ctx: Compiler, node: Node, frame: Frame): void => {
  const rawKey = node.key as Node;
  const val = node.value as Node;
  const key = isSymbol(rawKey)
    ? literal(rawKey.lineno, rawKey.colno, rawKey.value)
    : rawKey;

  if (!isSymbol(rawKey) && !(isLiteral(rawKey) &&
    typeof rawKey.value === 'string')) {
    ctx.fail('compilePair: Dict keys must be strings or names',
      rawKey.lineno,
      rawKey.colno);
  }

  ctx.compile(key, frame);
  ctx.emit(': ');
  ctx.compileExpression(val, frame);
};

const compileKeywordArgs = (ctx: Compiler, node: Node, frame: Frame): void => {
  ctx.emit('runtime.makeKeywordArgs(');
  compileDict(ctx, node, frame);
  ctx.emit(')');
};

const compileSpread = (ctx: Compiler, node: Node, frame: Frame): void => {
  ctx.emit('...');
  ctx.compile(node.argument as Node, frame);
};

const escapeTemplateString = (str: string): string =>
  reduce([...str], (result, char) => result + (TEMPLATE_ESCAPE_MAP[char] ?? char), '');

const compileTemplateLiteral = (ctx: Compiler, node: Node, frame: Frame): void => {
  const rawQuasis = (node.quasis as { quasis?: unknown[] } | unknown[] | undefined);
  const quasis: unknown[] = Array.isArray(rawQuasis)
    ? rawQuasis
    : (rawQuasis as { quasis?: unknown[] })?.quasis || [];
  ctx.emit('`');

  forEach(quasis, quasi => {
    const q = quasi as Node & { value?: string };
    if ((q.type as string) === 'template') {
      ctx.emit(escapeTemplateString(q.value as string));
    } else if ((q.type as string) === 'expression') {
      ctx.emit('${');
      ctx.compile(q.node as Node, frame);
      ctx.emit('}');
    }
  });

  ctx.emit('`');
};

interface CompileAggregateOptions {
  startChar?: string;
  endChar?: string;
}

const compileAggregate = (ctx: Compiler, node: Node, frame: Frame, options?: CompileAggregateOptions): void => {
  const { startChar, endChar } = options ?? {};
  if (startChar) {
    ctx.emit(startChar);
  }

  const children = node.children ?? (node as unknown as Node[]);
  children.forEach((child: Node, i: number) => {
    if (i > 0) {
      ctx.emit(',');
    }
    if (isSpread(child)) {
      ctx.emit('...');
      ctx.compile(child.argument as Node, frame);
    } else {
      ctx.compile(child, frame);
    }
  });

  if (endChar) {
    ctx.emit(endChar);
  }
};

export { compileLiteral, compileSymbol, compileGroup, compileArray, compileDict, compileNodeList, compilePair, compileKeywordArgs, compileSpread, compileTemplateLiteral, compileAggregate };
