import type { Node } from '@nunjucks/nodes';
import { arrayPattern, isArrayPattern, isObjectPattern, isSymbol, objectPattern } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';

// WHY: pure source-string emitters and node-shape adapters for destructuring codegen —
// deterministic in/out with no compiler/frame state; extracted from pattern.ts so the
// destructuring orchestrator stays under the file-size cap.

export const patternPropertyKey = (key: unknown): string | null => {
  if (typeof key === 'string') {
    return key;
  }
  if (isSymbol(key)) {
    return key.value;
  }
  return null;
};

export const asObjectPattern = (node: Node): Node | null => {
  if (isObjectPattern(node)) {
    return node;
  }
  const { children } = node;
  if (!children) {
    return null;
  }
  return objectPattern(loc(node), children);
};

export const asArrayPattern = (node: Node): Node | null => {
  if (isArrayPattern(node)) {
    return node;
  }
  const { children } = node;
  if (!children) {
    return null;
  }
  return arrayPattern(loc(node), children);
};

export const safeMemberLookup = (source: string, key: string): string =>
  `runtime.optionalMemberLookup(${source}, ${JSON.stringify(key)})`;

export const safeArrayIndex = (source: string, index: number): string =>
  `(Array.isArray(${source}) ? ${source}[${index}] : (${source} != null && typeof ${source} === 'object' ? ${source}[${index}] : undefined))`;

export const arraySlice = (source: string, start: number): string =>
  `(${source} != null && Array.isArray(${source}) ? ${source}.slice(${start}) : undefined)`;

// WHY: the hasOwn guard keeps the rest-copy own-property-only — a bare for-in copies
// inherited enumerables, and a bracket-assigned '__proto__' key would [[Set]]-redirect
// the rest object's prototype instead of defining an own property.
export const objectRest = (source: string, restId: string): string =>
  `(() => { const ${restId} = {}; if (${source} != null && typeof ${source} === 'object') { for (const __k in ${source}) { if (Object.hasOwn(${source}, __k)) { ${restId}[__k] = ${source}[__k]; } } } return ${restId}; })()`;
