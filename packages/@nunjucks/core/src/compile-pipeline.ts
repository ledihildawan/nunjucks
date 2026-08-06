import { createCompiler } from '@nunjucks/compiler';
import { parse } from '@nunjucks/parser';
import type { ParseOptions } from '@nunjucks/parser';
import { transform } from '@nunjucks/transformers';
import { createFrame } from '@nunjucks/runtime';
import type { UndefinedMode } from '@nunjucks/runtime';

/**
 * Shared compile pipeline: source → parse → transform → compile → JS code string.
 *
 * Both render paths use this:
 * - Direct `render()` path (`render-helpers.ts`) — gets code string, passes to
 *   executor which does `new Function(code)()`.
 * - Template object path (`template-compiler.ts`) — gets code string, does
 *   `new Function(code)()` immediately to extract render functions.
 */
const compileToCode = (
  source: string,
  templateName: string,
  undefinedMode: UndefinedMode | undefined,
  parseOpts?: ParseOptions,
): string => {
  const c = createCompiler(templateName, undefinedMode, source);
  const ast = parse(source, [], parseOpts);
  const transformedAst = transform(ast);
  c.compile(transformedAst, createFrame());
  return c.getCode();
};

export { compileToCode };
