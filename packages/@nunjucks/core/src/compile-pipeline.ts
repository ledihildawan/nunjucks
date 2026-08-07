import { createCompiler } from '@nunjucks/compiler';
import { parse } from '@nunjucks/parser';
import type { ParseOptions } from '@nunjucks/parser';
import { transform } from '@nunjucks/transformers';
import { createFrame } from '@nunjucks/runtime';
import type { UndefinedMode } from '@nunjucks/runtime';

const compileToCode = (
  source: string,
  templateName: string,
  undefinedMode: UndefinedMode | undefined,
  parseOpts?: ParseOptions,
): string => {
  const compiler = createCompiler(templateName, undefinedMode, source);
  const ast = parse(source, [], parseOpts);
  const transformedAst = transform(ast);
  compiler.compile(transformedAst, createFrame());
  return compiler.getCode();
};

export { compileToCode };
