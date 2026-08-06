import { isLiteral, isSpread, isSymbol, literal } from '@nunjucks/nodes';
import type { Node, SymbolNode, ChildrenNode, PairNode, SpreadNode, TemplateLiteralNode, CallNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
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
  for (const char of str) {
    result += STRING_ESCAPE_MAP[char] ?? char;
  }
  return result;
};

const compileLiteral = (ctx: Compiler, node: { value?: unknown; lineno: number; colno: number }): void => {
  if (typeof node.value === 'string') {
    const val = escapeString(node.value);
    ctx.emit(`"${val}"`);
  } else if (node.value === null) {
    ctx.emit('null');
  } else {
    ctx.emit(String(node.value));
  }
};

const compileSymbol = (ctx: Compiler, node: SymbolNode, frame: Frame): void => {
  const name = node.value;
  const v = frame.lookup(name);

  if (v) {
    ctx.emit(String(v));
  } else {
    ctx.emit('runtime.contextOrFrameLookup(' +
      'context, frame, "' + name + '")');
  }
};

const compileGroup = (ctx: Compiler, node: ChildrenNode, frame: Frame): void => {
  compileAggregate(ctx, node, frame, { startChar: '(', endChar: ')' });
};

const compileArray = (ctx: Compiler, node: ChildrenNode, frame: Frame): void => {
  compileAggregate(ctx, node, frame, { startChar: '[', endChar: ']' });
};

const compileDict = (ctx: Compiler, node: ChildrenNode, frame: Frame): void => {
  compileAggregate(ctx, node, frame, { startChar: '{', endChar: '}' });
};

const compileNodeList = (ctx: Compiler, node: ChildrenNode, frame: Frame): void => {
  ctx.compileChildren(node, frame);
};

const compilePair = (ctx: Compiler, node: PairNode, frame: Frame): void => {
  const rawKey = node.key;
  const val = node.value;
  const key = isSymbol(rawKey)
    ? literal(rawKey.lineno, rawKey.colno, rawKey.value)
    : rawKey;

  if (typeof rawKey !== 'string' && !isSymbol(rawKey) && !(isLiteral(rawKey) &&
    typeof rawKey.value === 'string')) {
    ctx.fail('compilePair: Dict keys must be strings or names',
      typeof rawKey !== 'string' ? rawKey.lineno : node.lineno,
      typeof rawKey !== 'string' ? rawKey.colno : node.colno);
  }

  const keyNode = typeof key === 'string' ? literal(node.lineno, node.colno, key) : key;
  ctx.compile(keyNode, frame);
  ctx.emit(': ');
  ctx.compileExpression(val, frame);
};

const compileKeywordArgs = (ctx: Compiler, node: ChildrenNode, frame: Frame): void => {
  ctx.emit('runtime.makeKeywordArgs(');
  compileDict(ctx, node, frame);
  ctx.emit(')');
};

const compileSpread = (ctx: Compiler, node: SpreadNode, frame: Frame): void => {
  ctx.emit('...');
  ctx.compile(node.argument, frame);
};

const escapeTemplateString = (str: string): string => {
  let result = '';
  for (const char of str) {
    result += TEMPLATE_ESCAPE_MAP[char] ?? char;
  }
  return result;
};

interface TemplateQuasi {
  type: 'template' | 'expression';
  value?: unknown;
  node?: Node;
}

const compileTemplateLiteral = (ctx: Compiler, node: TemplateLiteralNode, frame: Frame): void => {
  const quasis = node.quasis ?? [];
  ctx.emit('`');

  forEach(quasis, (quasi) => {
    const q = quasi as TemplateQuasi;
    if (q.type === 'template') {
      ctx.emit(escapeTemplateString(String(q.value ?? '')));
    } else if (q.type === 'expression') {
      ctx.emit('${');
      if (q.node) {
        ctx.compile(q.node, frame);
      }
      ctx.emit('}');
    }
  });

  ctx.emit('`');
};

interface CompileAggregateOptions {
  startChar?: string;
  endChar?: string;
}

const compileAggregate = (ctx: Compiler, node: ChildrenNode | CallNode | readonly Node[], frame: Frame, options?: CompileAggregateOptions): void => {
  const { startChar, endChar } = options ?? {};
  if (startChar) {
    ctx.emit(startChar);
  }

  const children: readonly Node[] = Array.isArray(node) ? node : ((node as ChildrenNode).children ?? []);
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (!child) { continue; }
    if (i > 0) {
      ctx.emit(',');
    }
    if (isSpread(child)) {
      ctx.emit('...');
      ctx.compile(child.argument, frame);
    } else {
      ctx.compile(child, frame);
    }
  }

  if (endChar) {
    ctx.emit(endChar);
  }
};

export { compileLiteral, compileSymbol, compileGroup, compileArray, compileDict, compileNodeList, compilePair, compileKeywordArgs, compileSpread, compileTemplateLiteral, compileAggregate };
