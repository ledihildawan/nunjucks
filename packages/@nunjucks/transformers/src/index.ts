import type { Node } from '@nunjucks/nodes/types';
import { liftPipes } from './pipe.ts';
import { liftSuper } from './super.ts';
import { convertStatements } from './statement.ts';

export const cps = (ast: Node, asyncPipes: string[]): Node =>
  convertStatements(liftSuper(liftPipes(ast, asyncPipes)));

export const transform = (ast: Node, asyncPipes: string[] = []): Node =>
  cps(ast, asyncPipes);

export * from './pipe.ts';
export * from './super.ts';
export * from './statement.ts';
export * from './symbol.ts';
