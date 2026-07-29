import type { Node } from '@nunjucks/nodes/types';
import { liftSuper } from './super.ts';

export const transform = (ast: Node): Node => liftSuper(ast);

export * from './super.ts';
export * from './symbol.ts';
