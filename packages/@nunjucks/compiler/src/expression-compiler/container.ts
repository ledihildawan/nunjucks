import type {
  CallNode,
  ChildrenNode,
  Node,
  PairNode,
  SpreadNode,
  SymbolNode,
  TemplateLiteralNode,
} from '@nunjucks/nodes';
import { isLiteral, isSpread, isSymbol, literal } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { loc } from '@nunjucks/shared';
import { forEach, join, map, pipe } from 'remeda';
import { assertSafeIdentifier } from '../codegen.ts';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';

const TEMPLATE_ESCAPE_MAP: Record<string, string> = {
  '\\': '\\\\',
  '`': '\\`',
  $: '\\$',
};

/**
 * Compiles a literal to a JS literal: strings via `JSON.stringify` (which
 * covers control characters and U+2029), `null`, or raw `String(value)`.
 */
const compileLiteral = (
  compiler: Compiler,
  node: { value?: unknown; lineno: number; colno: number }
): void => {
  if (typeof node.value === 'string') {
    // WHY: JSON.stringify emits a valid double-quoted JS literal and, unlike the former
    // hand-rolled per-char escape map, also covers control characters and U+2029 uniformly.
    compiler.emit(JSON.stringify(node.value));
  } else if (node.value === null) {
    compiler.emit('null');
  } else {
    compiler.emit(String(node.value));
  }
};

/**
 * Compiles a name reference: bound frame names emit the compiled id directly,
 * otherwise they fall back to
 * `runtime.contextOrFrameLookup(context, frame, "name")` after passing
 * `assertSafeIdentifier`.
 */
const compileSymbol = (compiler: Compiler, { node, frame }: CompileNodeInput<SymbolNode>): void => {
  const name = node.value;
  const lookupResult = frame.lookup(name);

  if (lookupResult) {
    compiler.emit(String(lookupResult));
  } else {
    assertSafeIdentifier(name, { compiler });
    compiler.emit(`runtime.contextOrFrameLookup(context, frame, ${JSON.stringify(name)})`);
  }
};

/** Compiles a parenthesized group as a `(children)` aggregate. */
const compileGroup = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<ChildrenNode>
): void => {
  compileAggregate(compiler, { node, frame, options: { startChar: '(', endChar: ')' } });
};

/** Compiles an array literal as a `[children]` aggregate. */
const compileArray = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<ChildrenNode>
): void => {
  compileAggregate(compiler, { node, frame, options: { startChar: '[', endChar: ']' } });
};

/** Compiles a dict literal as a `{children}` aggregate of `key: value` pairs. */
const compileDict = (compiler: Compiler, { node, frame }: CompileNodeInput<ChildrenNode>): void => {
  compileAggregate(compiler, { node, frame, options: { startChar: '{', endChar: '}' } });
};

/** Compiles a bare child list by compiling each child in order. */
const compileNodeList = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<ChildrenNode>
): void => {
  compiler.compileChildren(node, frame);
};

/**
 * Compiles one `key: value` dict entry, normalizing symbol keys to literals
 * and emitting `["__proto__"]` computed so the key stays an own property.
 */
const compilePair = (compiler: Compiler, { node, frame }: CompileNodeInput<PairNode>): void => {
  const rawKey = node.key;
  const value = node.value;
  const key = isSymbol(rawKey) ? literal(loc(rawKey), rawKey.value) : rawKey;

  if (
    typeof rawKey !== 'string' &&
    !isSymbol(rawKey) &&
    !(isLiteral(rawKey) && typeof rawKey.value === 'string')
  ) {
    compiler.fail({
      message: 'compilePair: Dict keys must be strings or names',
      lineno: typeof rawKey !== 'string' ? rawKey.lineno : node.lineno,
      colno: typeof rawKey !== 'string' ? rawKey.colno : node.colno,
    });
  }

  const keyNode = typeof key === 'string' ? literal(loc(node), key) : key;
  // WHY: a plain "__proto__" string key in an object literal redirects the dict's
  // prototype (ES [[SetPrototypeOf]] semantics) instead of defining an own property —
  // emit it computed so it always becomes an own property, matching the runtime's
  // own-property-only lookup contract.
  if (isLiteral(keyNode) && keyNode.value === '__proto__') {
    compiler.emit('["__proto__"]');
  } else {
    compiler.compile(keyNode, frame);
  }
  compiler.emit(': ');
  compiler.compileExpression(value, frame);
};

/** Compiles keyword arguments as `runtime.makeKeywordArgs({...})` around the dict. */
const compileKeywordArgs = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<ChildrenNode>
): void => {
  compiler.emit('runtime.makeKeywordArgs(');
  compileDict(compiler, { node, frame });
  compiler.emit(')');
};

/** Compiles `...argument` spread syntax. */
const compileSpread = (compiler: Compiler, { node, frame }: CompileNodeInput<SpreadNode>): void => {
  compiler.emit('...');
  compiler.compile(node.argument, frame);
};

const escapeTemplateString = (str: string): string =>
  join('')(
    pipe(
      [...str],
      map((char) => TEMPLATE_ESCAPE_MAP[char] ?? char)
    )
  );

/**
 * Compiles a template literal as a JS backtick literal, escaping
 * `` ` ``/`$`/`\` in text quasis and interpolating expression quasis.
 */
const compileTemplateLiteral = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<TemplateLiteralNode>
): void => {
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

interface CompileAggregateInput {
  node: ChildrenNode | CallNode | readonly Node[];
  frame: Frame;
  options?: CompileAggregateOptions;
}

/**
 * Emits container nodes as delimited child lists: groups `(...)`, arrays
 * `[...]`, dicts `{...}`, and call args, expanding spread children inline.
 */
const compileAggregate = (
  compiler: Compiler,
  { node, frame, options }: CompileAggregateInput
): void => {
  const { startChar, endChar } = options ?? {};
  if (startChar) {
    compiler.emit(startChar);
  }

  const children: readonly Node[] = Array.isArray(node)
    ? node
    : ((node as ChildrenNode).children ?? []);
  // WHY: imperative loop — comma placement between emitted fragments is
  // order-sensitive; a map().join() cannot interleave into the shared emit buffer.
  // Compiler emission exemption.
  // WHY: commas separate emitted children, not indices — a null child mid-list must
  // be skipped without emitting a stray comma (an array hole `[a,,b]`); nulls are
  // unreachable via the parser but this stays correct for hand-built nodes.
  let emittedAny = false;
  for (const child of children) {
    if (!child) {
      continue;
    }
    if (emittedAny) {
      compiler.emit(',');
    }
    if (isSpread(child)) {
      compiler.emit('...');
      compiler.compile(child.argument, frame);
    } else {
      compiler.compile(child, frame);
    }
    emittedAny = true;
  }

  if (endChar) {
    compiler.emit(endChar);
  }
};

export {
  compileAggregate,
  compileArray,
  compileDict,
  compileGroup,
  compileKeywordArgs,
  compileLiteral,
  compileNodeList,
  compilePair,
  compileSpread,
  compileSymbol,
  compileTemplateLiteral,
};
