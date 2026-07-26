import { arrayPattern, isArray, isArrayPattern, isAssignmentPattern, isDict, isHole, isObjectPattern, isPair, isPatternProperty, isRestPattern, isSymbol, objectPattern } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';

/**
 * What stays fixed for the whole of one destructuring compilation. Only the
 * pattern node and its source expression change as the recursion descends,
 * so these three travel together instead of being re-threaded at every call.
 */
interface DestructuringContext {
  ctx: Compiler;
  frame: Frame;
  /** False when compiling a macro signature, where frame slots already exist. */
  registerFrame: boolean;
}

/** An object-pattern key is either written literally or carried by a symbol node. */
const patternPropertyKey = (key: unknown): string | null => {
  if (typeof key === 'string') { return key; }
  if (isSymbol(key as Node)) { return (key as Node).value as string; }
  return null;
};

const uniqueId = (() => {
  let n = 0;
  return (prefix: string): string => {
    n += 1;
    return `${prefix}_${n}`;
  };
})();

const safeMemberLookup = (source: string, key: string): string =>
  `runtime.optionalMemberLookup(${source}, ${JSON.stringify(key)})`;

const safeArrayIndex = (source: string, index: number): string =>
  `(Array.isArray(${source}) ? ${source}[${index}] : (${source} != null && typeof ${source} === 'object' ? ${source}[${index}] : undefined))`;

const arraySlice = (source: string, start: number): string =>
  `(${source} != null && Array.isArray(${source}) ? ${source}.slice(${start}) : undefined)`;

const objectRest = (source: string, restId: string): string =>
  `(() => { const ${restId} = {}; if (${source} != null && typeof ${source} === 'object') { for (const __k in ${source}) { ${restId}[__k] = ${source}[__k]; } } return ${restId}; })()`;

const compileAssignToFrame = ({ ctx, frame, registerFrame }: DestructuringContext, name: string, source: string): void => {
  let existingId: string | null;
  if (registerFrame) {
    existingId = frame.lookup(name) as string;
  } else {
    existingId = null;
  }
  ctx.emitLine(`frame.set(${JSON.stringify(name)}, ${source}, true);`);
  if (name.charAt(0) !== '_') {
    ctx.emitLine('if(frame.topLevel) {');
    ctx.emitLine(`context.addExport(${JSON.stringify(name)}, ${source});`);
    ctx.emitLine('}');
  }
  if (!registerFrame) {
    return;
  }
  if (existingId !== null && existingId !== undefined) {
    ctx.emitLine(`let ${existingId} = ${source};`);
  } else {
    const id = ctx.tmpid();
    frame.set(name, id);
    ctx.emitLine(`let ${id} = ${source};`);
  }
};

/**
 * Emit `let __dflt_n = (source) === undefined ? (<expr>) : source;` and return
 * the temporary's name. The same four lines appeared at every site that has to
 * honour a destructuring default.
 */
const emitDefaultBinding = ({ ctx, frame }: DestructuringContext, source: string, defaultExpr: Node): string => {
  const defaultId = uniqueId('__dflt');
  ctx.emitLine(`let ${defaultId} = (${source}) === undefined ? (`);
  ctx.compileExpression(defaultExpr, frame);
  ctx.emitLine(`) : ${source};`);
  return defaultId;
};

/**
 * A dict or array literal in target position means the same thing as the
 * corresponding pattern node. Returns null when the literal has no children,
 * which the callers treat as "nothing to bind".
 */
const asObjectPattern = (node: Node): Node | null => {
  if (isObjectPattern(node)) { return node; }
  const { children } = node;
  if (!children) { return null; }
  return objectPattern(node.lineno, node.colno, children);
};

const asArrayPattern = (node: Node): Node | null => {
  if (isArrayPattern(node)) { return node; }
  const { children } = node;
  if (!children) { return null; }
  return arrayPattern(node.lineno, node.colno, children);
};

/** Bind each element of an array pattern, honouring holes, rest and defaults. */
const compileArrayPattern = (dc: DestructuringContext, pattern: Node, source: string): void => {
  let i = 0;
  const patternChildren = pattern.children;
  if (!patternChildren) {
    return;
  }
  for (const child of patternChildren) {
    if (isHole(child)) {
      i += 1;
      continue;
    }
    if (isRestPattern(child)) {
      const childSource = arraySlice(source, i);
      compileDestructuring(dc, child.target as Node, childSource);
      break;
    }
    const childSource = safeArrayIndex(source, i);
    if (isAssignmentPattern(child)) {
      const defaultId = emitDefaultBinding(dc, childSource, child.value as Node);
      compileDestructuring(dc, child.target as Node, defaultId);
    } else if (isObjectPattern(child) || isDict(child)) {
      const nestedPattern = asObjectPattern(child);
      // A childless literal binds nothing and, as before, does not consume
      // an array position.
      if (!nestedPattern) { continue; }
      compileDestructuring(dc, nestedPattern, childSource);
    } else {
      compileDestructuring(dc, child, childSource);
    }
    i += 1;
  }
};

/** Bind each property of an object pattern, honouring rest, aliases and defaults. */
const compileObjectPattern = (dc: DestructuringContext, pattern: Node, source: string): void => {
  const patternChildren = pattern.children;
  if (!patternChildren) {
    return;
  }
  for (const child of patternChildren) {
    if (isRestPattern(child)) {
      const restId = uniqueId('__rest');
      const childSource = objectRest(source, restId);
      compileDestructuring(dc, child.target as Node, childSource);
      continue;
    }
    if (isPatternProperty(child)) {
      const propKey = patternPropertyKey(child.key);
      if (propKey === null) {
        continue;
      }
      const propSource = safeMemberLookup(source, propKey);
      if (isAssignmentPattern(child.value)) {
        const valNode = child.value;
        const defaultId = emitDefaultBinding(dc, propSource, valNode.value);
        compileDestructuring(dc, valNode.target, defaultId);
      } else {
        compileDestructuring(dc, child.value, propSource);
      }
    } else if (isPair(child) && isSymbol(child.key as Node)) {
      const keyNode = child.key as Node;
      const propKey = keyNode.value as string;
      const propSource = safeMemberLookup(source, propKey);
      if (isAssignmentPattern(child.value as Node)) {
        const valNode = child.value as Node;
        const defaultId = emitDefaultBinding(dc, propSource, valNode.value as Node);
        const target = valNode.target as Node;
        compileAssignToFrame(dc, target.value as string, defaultId);
      } else if (isArrayPattern(child.value as Node) || isArray(child.value as Node)) {
        const nestedPattern = asArrayPattern(child.value as Node);
        if (!nestedPattern) { continue; }
        compileDestructuring(dc, nestedPattern, propSource);
      } else if (isObjectPattern(child.value as Node) || isDict(child.value as Node)) {
        const nestedPattern = asObjectPattern(child.value as Node);
        if (!nestedPattern) { continue; }
        compileDestructuring(dc, nestedPattern, propSource);
      } else if (isSymbol(child.value as Node)) {
        const aliasName = (child.value as Node).value as string;
        compileAssignToFrame(dc, aliasName, propSource);
      }
    }
  }
};

const compileDestructuring = (dc: DestructuringContext, pattern: Node, source: string): void => {
  if (isSymbol(pattern)) {
    compileAssignToFrame(dc, pattern.value as string, source);
    return;
  }
  if (isArrayPattern(pattern)) {
    compileArrayPattern(dc, pattern, source);
    return;
  }
  if (isObjectPattern(pattern)) {
    compileObjectPattern(dc, pattern, source);
  }
};

export { compileDestructuring };

export type { DestructuringContext };
