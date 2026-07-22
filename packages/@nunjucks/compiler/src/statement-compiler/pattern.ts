import { arrayPattern, isArray, isArrayPattern, isAssignmentPattern, isDict, isHole, isObjectPattern, isPair, isPatternProperty, isRestPattern, isSymbol, objectPattern } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';

const uniqueId = (() => {
  let n = 0;
  return (prefix: string): string => `${prefix}_${++n}`;
})();

const safeMemberLookup = (source: string, key: string): string =>
  `runtime.optionalMemberLookup(${source}, ${JSON.stringify(key)})`;

const safeArrayIndex = (source: string, index: number): string =>
  `(Array.isArray(${source}) ? ${source}[${index}] : (${source} != null && typeof ${source} === 'object' ? ${source}[${index}] : undefined))`;

const arraySlice = (source: string, start: number): string =>
  `(${source} != null && Array.isArray(${source}) ? ${source}.slice(${start}) : undefined)`;

const objectRest = (source: string, restId: string): string =>
  `(() => { const ${restId} = {}; if (${source} != null && typeof ${source} === 'object') { for (const __k in ${source}) { ${restId}[__k] = ${source}[__k]; } } return ${restId}; })()`;

const compileAssignToFrame = (ctx: Compiler, frame: Frame, name: string, source: string, registerFrame: boolean): void => {
  const existingId = registerFrame ? (frame.lookup(name) as string) : null;
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

const compileDestructuring = (ctx: Compiler, frame: Frame, pattern: Node, source: string, registerFrame: boolean = true): void => {
  if (isSymbol(pattern)) {
    compileAssignToFrame(ctx, frame, pattern.value as string, source, registerFrame);
    return;
  }

  if (isArrayPattern(pattern)) {
    let i = 0;
    for (const child of pattern.children!) {
      if (isHole(child)) {
        i++;
        continue;
      }
      if (isRestPattern(child)) {
        const childSource = arraySlice(source, i);
        compileDestructuring(ctx, frame, child.target as Node, childSource, registerFrame);
        break;
      }
      let childSource = safeArrayIndex(source, i);
      if (isAssignmentPattern(child)) {
        const defaultId = uniqueId('__dflt');
        ctx.emitLine(`let ${defaultId} = (${childSource}) === undefined ? (`);
        ctx.compileExpression(child.value as Node, frame);
        ctx.emitLine(`) : ${childSource};`);
        childSource = defaultId;
        compileDestructuring(ctx, frame, child.target as Node, childSource, registerFrame);
      } else if (isObjectPattern(child) || isDict(child)) {
        const nestedPattern = isObjectPattern(child)
          ? child
          : objectPattern(child.lineno, child.colno, child.children!);
        compileDestructuring(ctx, frame, nestedPattern, childSource, registerFrame);
      } else {
        compileDestructuring(ctx, frame, child, childSource, registerFrame);
      }
      i++;
    }
    return;
  }

  if (isObjectPattern(pattern)) {
    for (const child of pattern.children!) {
      if (isRestPattern(child)) {
        const restId = uniqueId('__rest');
        const childSource = objectRest(source, restId);
        compileDestructuring(ctx, frame, child.target as Node, childSource, registerFrame);
        continue;
      }
      if (isPatternProperty(child)) {
        let propSource = safeMemberLookup(source, child.key as unknown as string);
        if (isAssignmentPattern(child.value as Node)) {
          const valNode = child.value as Node;
          const defaultId = uniqueId('__dflt');
          ctx.emitLine(`let ${defaultId} = (${propSource}) === undefined ? (`);
          ctx.compileExpression(valNode.value as Node, frame);
          ctx.emitLine(`) : ${propSource};`);
          propSource = defaultId;
          compileDestructuring(ctx, frame, valNode.target as Node, propSource, registerFrame);
        } else {
          compileDestructuring(ctx, frame, child.value as Node, propSource, registerFrame);
        }
      } else if (isPair(child) && isSymbol(child.key as Node)) {
        const keyNode = child.key as Node;
        const propKey = keyNode.value as string;
        const propSource = safeMemberLookup(source, propKey);
        if (isAssignmentPattern(child.value as Node)) {
          const valNode = child.value as Node;
          const defaultId = uniqueId('__dflt');
          ctx.emitLine(`let ${defaultId} = (${propSource}) === undefined ? (`);
          ctx.compileExpression(valNode.value as Node, frame);
          ctx.emitLine(`) : ${propSource};`);
          const target = valNode.target as Node;
          compileAssignToFrame(ctx, frame, target.value as string, defaultId, registerFrame);
        } else if (isArrayPattern(child.value as Node) || isArray(child.value as Node)) {
          const valNode = child.value as Node;
          const nestedPattern = isArrayPattern(valNode)
            ? valNode
            : arrayPattern(valNode.lineno, valNode.colno, valNode.children!);
          compileDestructuring(ctx, frame, nestedPattern, propSource, registerFrame);
        } else if (isObjectPattern(child.value as Node) || isDict(child.value as Node)) {
          const valNode = child.value as Node;
          const nestedPattern = isObjectPattern(valNode)
            ? valNode
            : objectPattern(valNode.lineno, valNode.colno, valNode.children!);
          compileDestructuring(ctx, frame, nestedPattern, propSource, registerFrame);
        } else if (isSymbol(child.value as Node)) {
          const aliasName = (child.value as Node).value as string;
          compileAssignToFrame(ctx, frame, aliasName, propSource, registerFrame);
        }
      }
    }
    return;
  }
};

export { compileDestructuring };
