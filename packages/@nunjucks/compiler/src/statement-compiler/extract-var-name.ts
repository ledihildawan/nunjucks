import type { Node } from '@nunjucks/nodes';
import { isLookupVal, isSymbol } from '@nunjucks/nodes';

// WHY: a lookup's property normally rides a literal/symbol `.value`; the `name`
// field covers hand-built nodes (e.g. call references) that carry it instead.
const hasNameField = (node: Node): node is Node & { readonly name: unknown } => 'name' in node;

/** Builds the dotted `a.b.c` path from a symbol/lookup chain, or `null`. */
export const extractVarName = (node: Node): string | null => {
  if (isSymbol(node)) {
    return node.value;
  }

  if (isLookupVal(node)) {
    const targetName = extractVarName(node.target);
    if (!targetName) {
      return null;
    }
    const value = node.val;
    const nameValue = hasNameField(value) ? value.name : undefined;
    const property = value?.value ?? String(nameValue ?? '');
    return `${targetName}.${property}`;
  }

  return null;
};
