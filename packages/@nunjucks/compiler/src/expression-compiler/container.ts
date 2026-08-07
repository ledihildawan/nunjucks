import { isLiteral, isSpread, isSymbol, literal } from '@nunjucks/nodes';
import type { Node, SymbolNode, ChildrenNode, PairNode, SpreadNode, TemplateLiteralNode, CallNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { forEach, join, map, pipe } from 'remeda';
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
  join('')(pipe(str.split(''), map((char) => STRING_ESCAPE_MAP[char] ?? char)));

const compileLiteral = (compiler: Compiler, node: { value?: unknown; lineno: number; colno: number }): void => {
  if (typeof node.value === 'string') {
    const value = escapeString(node.value);
    compiler.emit(`"${value}"`);
  } else if (node.value === null) {
    compiler.emit('null');
  } else {
    compiler.emit(String(node.value));
  }
};

const compileSymbol = (compiler: Compiler, node: SymbolNode, frame: Frame): void => {
  const name = node.value;
  const v = frame.lookup(name);

  if (v) {
    compiler.emit(String(v));
  } else {
    compiler.emit('runtime.contextOrFrameLookup(' +
      'context, frame, "' + name + '")');
  }
};

const compileGroup = (compiler: Compiler, node: ChildrenNode, frame: Frame): void => {
  compileAggregate(compiler, node, frame, { startChar: '(', endChar: ')' });
};

const compileArray = (compiler: Compiler, node: ChildrenNode, frame: Frame): void => {
  compileAggregate(compiler, node, frame, { startChar: '[', endChar: ']' });
};

const compileDict = (compiler: Compiler, node: ChildrenNode, frame: Frame): void => {
  compileAggregate(compiler, node, frame, { startChar: '{', endChar: '}' });
};

const compileNodeList = (compiler: Compiler, node: ChildrenNode, frame: Frame): void => {
  compiler.compileChildren(node, frame);
};

const compilePair = (compiler: Compiler, node: PairNode, frame: Frame): void => {
  const rawKey = node.key;
  const value = node.value;
  const key = isSymbol(rawKey)
    ? literal(rawKey.lineno, rawKey.colno, rawKey.value)
    : rawKey;

  if (typeof rawKey !== 'string' && !isSymbol(rawKey) && !(isLiteral(rawKey) &&
    typeof rawKey.value === 'string')) {
    compiler.fail('compilePair: Dict keys must be strings or names',
      typeof rawKey !== 'string' ? rawKey.lineno : node.lineno,
      typeof rawKey !== 'string' ? rawKey.colno : node.colno);
  }

  const keyNode = typeof key === 'string' ? literal(node.lineno, node.colno, key) : key;
  compiler.compile(keyNode, frame);
  compiler.emit(': ');
  compiler.compileExpression(value, frame);
};

const compileKeywordArgs = (compiler: Compiler, node: ChildrenNode, frame: Frame): void => {
  compiler.emit('runtime.makeKeywordArgs(');
  compileDict(compiler, node, frame);
  compiler.emit(')');
};

const compileSpread = (compiler: Compiler, node: SpreadNode, frame: Frame): void => {
  compiler.emit('...');
  compiler.compile(node.argument, frame);
};

const escapeTemplateString = (str: string): string =>
  join('')(pipe(str.split(''), map((char) => TEMPLATE_ESCAPE_MAP[char] ?? char)));

const compileTemplateLiteral = (compiler: Compiler, node: TemplateLiteralNode, frame: Frame): void => {
  const quasis = node.quasis ?? [];
  compiler.emit('`');

  forEach(quasis, (quasi) => {
    if (quasi.type === 'template') {
      compiler.emit(escapeTemplateString(String(quasi.value ?? '')));
    } else if (quasi.type === 'expression') {
      compiler.emit('${');
      if (quasi.node) {
        compiler.compile(quasi.node, frame);
      }
      compiler.emit('}');
    }
  });

  compiler.emit('`');
};

interface CompileAggregateOptions {
  startChar?: string;
  endChar?: string;
}

const compileAggregate = (compiler: Compiler, node: ChildrenNode | CallNode | readonly Node[], frame: Frame, options?: CompileAggregateOptions): void => {
  const { startChar, endChar } = options ?? {};
  if (startChar) {
    compiler.emit(startChar);
  }

  const children: readonly Node[] = Array.isArray(node) ? node : ((node as ChildrenNode).children ?? []);
  children.forEach((child, i) => {
    if (!child) { return; }
    if (i > 0) {
      compiler.emit(',');
    }
    if (isSpread(child)) {
      compiler.emit('...');
      compiler.compile(child.argument, frame);
    } else {
      compiler.compile(child, frame);
    }
  });

  if (endChar) {
    compiler.emit(endChar);
  }
};

export { compileLiteral, compileSymbol, compileGroup, compileArray, compileDict, compileNodeList, compilePair, compileKeywordArgs, compileSpread, compileTemplateLiteral, compileAggregate };
