import { arrayPattern, isArray, isArrayPattern, isAssignmentPattern, isDict, isHole, isObjectPattern, isPair, isPatternProperty, isRestPattern, isSymbol, objectPattern } from '@nunjucks/nodes';
import type { Node, PairNode, RestPatternNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
import type { Compiler } from '../index.ts';

/**
 * What stays fixed for the whole of one destructuring compilation. Only the
 * pattern node and its source expression change as the recursion descends,
 * so these three travel together instead of being re-threaded at every call.
 */
interface DestructuringContext {
  ctx: Compiler;
  frame: Frame;
  /** False when compiling a component signature, where frame slots already exist. */
  registerFrame: boolean;
}

const patternPropertyKey = (key: unknown): string | null => {
  if (typeof key === 'string') { return key; }
  if (isSymbol(key)) { return key.value; }
  return null;
};

const safeMemberLookup = (source: string, key: string): string =>
  `runtime.optionalMemberLookup(${source}, ${JSON.stringify(key)})`;

const safeArrayIndex = (source: string, index: number): string =>
  `(Array.isArray(${source}) ? ${source}[${index}] : (${source} != null && typeof ${source} === 'object' ? ${source}[${index}] : undefined))`;

const arraySlice = (source: string, start: number): string =>
  `(${source} != null && Array.isArray(${source}) ? ${source}.slice(${start}) : undefined)`;

const objectRest = (source: string, restId: string): string =>
  `(() => { const ${restId} = {}; if (${source} != null && typeof ${source} === 'object') { for (const __k in ${source}) { ${restId}[__k] = ${source}[__k]; } } return ${restId}; })()`;

const compileAssignToFrame = ({ ctx, frame, registerFrame }: DestructuringContext, name: string, source: string): void => {
  const existingId = registerFrame ? (frame.lookup(name) as string) : null;
  ctx.emitLine(`frame.set(${JSON.stringify(name)}, ${source}, true);`);
  if (name.charAt(0) !== '_') {
    ctx.emitLine('if(frame.topLevel) {');
    ctx.emitLine(`context.addExport(${JSON.stringify(name)});`);
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
  const defaultId = ctx.tmpid();
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

const compileArrayPattern = (dc: DestructuringContext, pattern: Node, source: string): void => {
  let i = 0;
  const patternChildren = pattern.children;
  if (!patternChildren) {
    return;
  }
  for (const child of patternChildren) {
    const result = handleArrayPatternChild(dc, child, source, i);
    i = result.newIndex;
    if (result.shouldBreak) {
      break;
    }
  }
};

const handleArrayPatternChild = (
  dc: DestructuringContext,
  child: Node,
  source: string,
  i: number
): { newIndex: number; shouldBreak: boolean } => {
  if (isHole(child)) {
    return { newIndex: i + 1, shouldBreak: false };
  }
  if (isRestPattern(child)) {
    const childSource = arraySlice(source, i);
    compileDestructuring(dc, child.target, childSource);
    return { newIndex: i, shouldBreak: true };
  }
  const childSource = safeArrayIndex(source, i);
  if (isAssignmentPattern(child)) {
    const defaultId = emitDefaultBinding(dc, childSource, child.value);
    compileDestructuring(dc, child.target, defaultId);
  } else if (isObjectPattern(child) || isDict(child)) {
    const nestedPattern = asObjectPattern(child);
    if (!nestedPattern) { return { newIndex: i + 1, shouldBreak: false }; }
    compileDestructuring(dc, nestedPattern, childSource);
  } else {
    compileDestructuring(dc, child, childSource);
  }
  return { newIndex: i + 1, shouldBreak: false };
};

const handlePatternPropertyValue = (
  dc: DestructuringContext,
  child: PairNode,
  propSource: string
): void => {
  if (isAssignmentPattern(child.value)) {
    const valNode = child.value;
    const defaultId = emitDefaultBinding(dc, propSource, valNode.value);
    compileDestructuring(dc, valNode.target, defaultId);
  } else {
    compileDestructuring(dc, child.value, propSource);
  }
};

const handleRestProperty = (
  dc: DestructuringContext,
  child: RestPatternNode,
  source: string
): void => {
  const restId = dc.ctx.tmpid();
  const childSource = objectRest(source, restId);
  compileDestructuring(dc, child.target, childSource);
};

const handlePairSymbolAlias = (
  dc: DestructuringContext,
  child: PairNode,
  propSource: string
): boolean => {
  if (isSymbol(child.value)) {
    const aliasName = child.value.value;
    compileAssignToFrame(dc, aliasName, propSource);
    return true;
  }
  return false;
};

const handlePairArrayOrObjectPattern = (
  dc: DestructuringContext,
  child: PairNode,
  propSource: string
): boolean => {
  if (isArrayPattern(child.value) || isArray(child.value)) {
    const nestedPattern = asArrayPattern(child.value);
    if (!nestedPattern) { return true; }
    compileDestructuring(dc, nestedPattern, propSource);
    return true;
  }
  if (isObjectPattern(child.value) || isDict(child.value)) {
    const nestedPattern = asObjectPattern(child.value);
    if (!nestedPattern) { return true; }
    compileDestructuring(dc, nestedPattern, propSource);
    return true;
  }
  return false;
};

const handlePairAssignmentWithDefault = (
  dc: DestructuringContext,
  child: PairNode,
  propSource: string
): boolean => {
  if (isAssignmentPattern(child.value)) {
    const valNode = child.value;
    const defaultId = emitDefaultBinding(dc, propSource, valNode.value);
    const target = valNode.target;
    compileAssignToFrame(dc, target.value as string, defaultId);
    return true;
  }
  return false;
};

const handlePairProperty = (
  dc: DestructuringContext,
  child: PairNode,
  propSource: string
): void => {
  if (handlePairAssignmentWithDefault(dc, child, propSource)) {
    return;
  }
  if (handlePairArrayOrObjectPattern(dc, child, propSource)) {
    return;
  }
  if (handlePairSymbolAlias(dc, child, propSource)) {
    return;
  }
};

const processObjectPatternChild = (
  dc: DestructuringContext,
  child: Node,
  source: string
): void => {
  if (isRestPattern(child)) {
    handleRestProperty(dc, child, source);
    return;
  }
  if (isPatternProperty(child)) {
    const propKey = patternPropertyKey(child.key);
    if (propKey === null) {
      return;
    }
    const propSource = safeMemberLookup(source, propKey);
    handlePatternPropertyValue(dc, child, propSource);
    return;
  }
  if (isPair(child) && isSymbol(child.key)) {
    const propKey = child.key.value as string;
    const propSource = safeMemberLookup(source, propKey);
    handlePairProperty(dc, child, propSource);
  }
};

const compileObjectPattern = (dc: DestructuringContext, pattern: Node, source: string): void => {
  const patternChildren = pattern.children;
  if (!patternChildren) {
    return;
  }
  forEach(patternChildren, child => processObjectPatternChild(dc, child, source));
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
