import type { Node } from '@nunjucks/nodes';
import { liftSuper } from './super.ts';

/**
 * Applies all AST transformations (super-call lifting, etc.) and returns the
 * transformed root node.
 *
 * @param ast - The parsed root AST node from the parser.
 * @returns The transformed AST ready for code generation.
 */
export const transform = (ast: Node): Node => liftSuper(ast);
