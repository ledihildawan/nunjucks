import type { Node, PairNode, RestPatternNode } from '@nunjucks/nodes';
import {
  isArray,
  isArrayPattern,
  isAssignmentPattern,
  isDict,
  isHole,
  isObjectPattern,
  isPair,
  isPatternProperty,
  isRestPattern,
  isSymbol,
} from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { forEach, reduce } from 'remeda';
import { assertSafeIdentifier } from '../codegen.ts';
import type { Compiler } from '../index.ts';
import {
  arraySlice,
  asArrayPattern,
  asObjectPattern,
  objectRest,
  patternPropertyKey,
  safeArrayIndex,
  safeMemberLookup,
} from './pattern-emitters.ts';

interface DestructuringContext {
  compiler: Compiler;
  frame: Frame;
  registerFrame: boolean;
}

const compileAssignToFrame = (
  { compiler, frame, registerFrame }: DestructuringContext,
  name: string,
  source: string
): void => {
  // WHY: single validation funnel for destructuring target names before they are
  // emitted into generated source (the codegen boundary's primary injection defense).
  assertSafeIdentifier(name, { compiler });
  const existingId = registerFrame ? frame.lookup(name) : null;
  compiler.emitLine(
    `frame = frame.set({ name: ${JSON.stringify(name)}, value: ${source}, resolveUp: true });`
  );
  if (name[0] !== '_') {
    compiler.emitLine('if(frame.topLevel) {');
    compiler.emitLine(`context = context.addExport(${JSON.stringify(name)});`);
    compiler.emitLine('}');
  }
  if (!registerFrame) {
    return;
  }
  if (existingId !== null && existingId !== undefined) {
    compiler.emitLine(`let ${existingId} = ${source};`);
  } else {
    const id = compiler.nextCompilerId();
    frame.set({ name, value: id });
    compiler.emitLine(`let ${id} = ${source};`);
  }
};

const emitDefaultBinding = (
  { compiler, frame }: DestructuringContext,
  source: string,
  defaultExpr: Node
): string => {
  const defaultId = compiler.nextCompilerId();
  compiler.emitLine(`let ${defaultId} = (${source}) === undefined ? (`);
  compiler.compileExpression(defaultExpr, frame);
  compiler.emitLine(`) : ${source};`);
  return defaultId;
};

const compileArrayPattern = (
  destructuringContext: DestructuringContext,
  pattern: Node,
  source: string
): void => {
  const patternChildren = pattern.children;
  if (!patternChildren) {
    return;
  }
  reduce(
    patternChildren,
    (state, child) => {
      if (state.done) {
        return state;
      }
      const result = handleArrayPatternChild({ destructuringContext, child, source, index: state.index });
      return { index: result.newIndex, done: result.shouldBreak };
    },
    { index: 0, done: false }
  );
};

interface ArrayPatternChildInput {
  destructuringContext: DestructuringContext;
  child: Node;
  source: string;
  index: number;
}

const handleArrayPatternChild = ({
  destructuringContext,
  child,
  source,
  index,
}: ArrayPatternChildInput): { newIndex: number; shouldBreak: boolean } => {
  if (isHole(child)) {
    return { newIndex: index + 1, shouldBreak: false };
  }
  if (isRestPattern(child)) {
    const restSource = arraySlice(source, index);
    compileDestructuring(destructuringContext, child.target, restSource);
    return { newIndex: index, shouldBreak: true };
  }
  const indexedSource = safeArrayIndex(source, index);
  if (isAssignmentPattern(child)) {
    const defaultId = emitDefaultBinding(destructuringContext, indexedSource, child.value);
    compileDestructuring(destructuringContext, child.target, defaultId);
  } else if (isObjectPattern(child) || isDict(child)) {
    const nestedPattern = asObjectPattern(child);
    if (!nestedPattern) {
      return { newIndex: index + 1, shouldBreak: false };
    }
    compileDestructuring(destructuringContext, nestedPattern, indexedSource);
  } else {
    compileDestructuring(destructuringContext, child, indexedSource);
  }
  return { newIndex: index + 1, shouldBreak: false };
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
  const restId = destructuringContext.compiler.nextCompilerId();
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
    if (!nestedPattern) {
      return true;
    }
    compileDestructuring(destructuringContext, nestedPattern, propSource);
    return true;
  }
  if (isObjectPattern(child.value) || isDict(child.value)) {
    const nestedPattern = asObjectPattern(child.value);
    if (!nestedPattern) {
      return true;
    }
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
    compileAssignToFrame(destructuringContext, String(target.value), defaultId);
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

const compileObjectPattern = (
  destructuringContext: DestructuringContext,
  pattern: Node,
  source: string
): void => {
  const patternChildren = pattern.children;
  if (!patternChildren) {
    return;
  }
  forEach(patternChildren, (child) =>
    processObjectPatternChild(destructuringContext, child, source)
  );
};

const compileDestructuring = (
  destructuringContext: DestructuringContext,
  pattern: Node,
  source: string
): void => {
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

export type { DestructuringContext };
export { compileDestructuring };
