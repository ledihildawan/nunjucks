// Nunjucks AST Transformers
// Tree-shakable: import only what you need from specific modules
//
// Examples:
//   import { walk, findAll } from '@nunjucks/transformers/walk'
//   import { liftPipes } from '@nunjucks/transformers/pipe'
//   import { liftSuper } from '@nunjucks/transformers/super'
//   import { createGensym } from '@nunjucks/transformers/symbol'
//
// Or import all (not tree-shakable):
//   import * as transformers from '@nunjucks/transformers'

import { type Node } from '@nunjucks/nodes/types';
import { liftPipes } from './pipe.ts';
import { liftSuper } from './super.ts';
import { convertStatements } from './statement.ts';

export const cps = (ast: Node, asyncPipes: string[]): Node =>
  convertStatements(liftSuper(liftPipes(ast, asyncPipes)));

export const transform = (ast: Node, asyncPipes: string[] = []): Node =>
  cps(ast, asyncPipes);

export * from './walk.ts';
export * from './pipe.ts';
export * from './super.ts';
export * from './statement.ts';
export * from './symbol.ts';
