import { arrayPattern, isArray, isArrayPattern, isAssignmentPattern, isDict, isHole, isObjectPattern, isPair, isPatternProperty, isRestPattern, isSymbol, objectPattern } from '@nunjucks/nodes';
import type { Node, PairNode, RestPatternNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
import type { Compiler } from '../index.ts';

interface DestructuringContext {
  ctx: Compiler;
  frame: Frame;
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

const compileAssignToFrame = ({ ctx: compiler, frame, registerFrame }: DestructuringContext, name: string, source: string): void => {
  const existingId = registerFrame ? frame.lookup(name) : null;
  compiler.emitLine(`frame.set(${JSON.stringify(name)}, ${source}, true);`);
  if (name[0] !== '_') {
    compiler.emitLine('if(frame.topLevel) {');
    compiler.emitLine(`context.addExport(${JSON.stringify(name)});`);
    compiler.emitLine('}');
  }
  if (!registerFrame) {
    return;
  }
  if (existingId !== null && existingId !== undefined) {
    compiler.emitLine(`let ${existingId} = ${source};`);
  } else {
    const id = compiler.tmpid();
    frame.set(name, id);
    compiler.emitLine(`let ${id} = ${source};`);
  }
};

const emitDefaultBinding = ({ ctx: compiler, frame }: DestructuringContext, source: string, defaultExpr: Node): string => {
  const defaultId = compiler.tmpid();
  compiler.emitLine(`let ${defaultId} = (${source}) === undefined ? (`);
  compiler.compileExpression(defaultExpr, frame);
  compiler.emitLine(`) : ${source};`);
  return defaultId;
};

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

const compileArrayPattern = (destructuringContext: DestructuringContext, pattern: Node, source: string): void => {
  let i = 0;
  const patternChildren = pattern.children;
  if (!patternChildren) {
    return;
  }
  for (const child of patternChildren) {
    const result = handleArrayPatternChild(destructuringContext, child, source, i);
    i = result.newIndex;
    if (result.shouldBreak) {
      break;
    }
  }
};

const handleArrayPatternChild = (
  destructuringContext: DestructuringContext,
  child: Node,
  source: string,
  i: number
): { newIndex: number; shouldBreak: boolean } => {
  if (isHole(child)) {
    return { newIndex: i + 1, shouldBreak: false };
  }
  if (isRestPattern(child)) {
    const restSource = arraySlice(source, i);
    compileDestructuring(destructuringContext, child.target, restSource);
    return { newIndex: i, shouldBreak: true };
  }
  const indexedSource = safeArrayIndex(source, i);
  if (isAssignmentPattern(child)) {
    const defaultId = emitDefaultBinding(destructuringContext, indexedSource, child.value);
    compileDestructuring(destructuringContext, child.target, defaultId);
  } else if (isObjectPattern(child) || isDict(child)) {
    const nestedPattern = asObjectPattern(child);
    if (!nestedPattern) { return { newIndex: i + 1, shouldBreak: false }; }
    compileDestructuring(destructuringContext, nestedPattern, indexedSource);
  } else {
    compileDestructuring(destructuringContext, child, indexedSource);
  }
  return { newIndex: i + 1, shouldBreak: false };
};

const handlePatternPropertyValue = (
  destructuringContext: DestructuringContext,
  child: PairNode,
  propSource: string
): void => {
  if (isAssignmentPattern(child.value)) {
    const valNode = child.value;
    const defaultId = emitDefaultBinding(destructuringContext, propSource, valNode.value);
    compileDestructuring(destructuringContext, valNode.target, defaultId);
  } else {
    compileDestructuring(destructuringContext, child.value, propSource);
  }
};

const handleRestProperty = (
  destructuringContext: DestructuringContext,
  child: RestPatternNode,
  source: string
): void => {
  const restId = destructuringContext.ctx.tmpid();
  const childSource = objectRest(source, restId);
  compileDestructuring(destructuringContext, child.target, childSource);
};

const handlePairSymbolAlias = (
  destructuringContext: DestructuringContext,
  child: PairNode,
  propSource: string
): boolean => {
  if (isSymbol(child.value)) {
    const aliasName = child.value.value;
    compileAssignToFrame(destructuringContext, aliasName, propSource);
    return true;
  }
  return false;
};

const handlePairArrayOrObjectPattern = (
  destructuringContext: DestructuringContext,
  child: PairNode,
  propSource: string
): boolean => {
  if (isArrayPattern(child.value) || isArray(child.value)) {
    const nestedPattern = asArrayPattern(child.value);
    if (!nestedPattern) { return true; }
    compileDestructuring(destructuringContext, nestedPattern, propSource);
    return true;
  }
  if (isObjectPattern(child.value) || isDict(child.value)) {
    const nestedPattern = asObjectPattern(child.value);
    if (!nestedPattern) { return true; }
    compileDestructuring(destructuringContext, nestedPattern, propSource);
    return true;
  }
  return false;
};

const handlePairAssignmentWithDefault = (
  destructuringContext: DestructuringContext,
  child: PairNode,
  propSource: string
): boolean => {
  if (isAssignmentPattern(child.value)) {
    const valNode = child.value;
    const defaultId = emitDefaultBinding(destructuringContext, propSource, valNode.value);
    const target = valNode.target;
    compileAssignToFrame(destructuringContext, target.value as string, defaultId);
    return true;
  }
  return false;
};

const handlePairProperty = (
  destructuringContext: DestructuringContext,
  child: PairNode,
  propSource: string
): void => {
  handlePairAssignmentWithDefault(destructuringContext, child, propSource) ||
    handlePairArrayOrObjectPattern(destructuringContext, child, propSource) ||
    handlePairSymbolAlias(destructuringContext, child, propSource);
};

const processObjectPatternChild = (
  destructuringContext: DestructuringContext,
  child: Node,
  source: string
): void => {
  if (isRestPattern(child)) {
    handleRestProperty(destructuringContext, child, source);
    return;
  }
  if (isPatternProperty(child)) {
    const propKey = patternPropertyKey(child.key);
    if (propKey === null) {
      return;
    }
    const propSource = safeMemberLookup(source, propKey);
    handlePatternPropertyValue(destructuringContext, child, propSource);
    return;
  }
  if (isPair(child) && isSymbol(child.key)) {
    const propKey = child.key.value;
    const propSource = safeMemberLookup(source, propKey);
    handlePairProperty(destructuringContext, child, propSource);
  }
};

const compileObjectPattern = (destructuringContext: DestructuringContext, pattern: Node, source: string): void => {
  const patternChildren = pattern.children;
  if (!patternChildren) {
    return;
  }
  forEach(patternChildren, child => processObjectPatternChild(destructuringContext, child, source));
};

const compileDestructuring = (destructuringContext: DestructuringContext, pattern: Node, source: string): void => {
  if (isSymbol(pattern)) {
    compileAssignToFrame(destructuringContext, pattern.value, source);
    return;
  }
  if (isArrayPattern(pattern)) {
    compileArrayPattern(destructuringContext, pattern, source);
    return;
  }
  if (isObjectPattern(pattern)) {
    compileObjectPattern(destructuringContext, pattern, source);
  }
};

export { compileDestructuring };

export type { DestructuringContext };
