import type { Node } from '@nunjucks/nodes/types';
import { liftSuper } from './super.ts';
import { convertStatements } from './statement.ts';

export const transform = (ast: Node): Node =>
  convertStatements(liftSuper(ast));

export * from './super.ts';
export * from './statement.ts';
export * from './symbol.ts';
