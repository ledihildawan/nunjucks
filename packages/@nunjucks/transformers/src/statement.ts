// STATEMENT - Transform statements in AST
// Import directly: import { convertStatements } from '@nunjucks/transformers/statement'

import { type Node } from '@nunjucks/nodes/types';

export const convertStatements = (ast: Node): Node => {
  // Statement transformations go here
  // Currently a pass-through
  return ast;
};
