import { createCompiler } from '@nunjucks/compiler';
import { parse } from '@nunjucks/parser';
import type { ParseOptions } from '@nunjucks/parser';
import { transform } from '@nunjucks/transformers';
import { createFrame } from '@nunjucks/runtime';
import type { UndefinedMode } from '@nunjucks/runtime';
import { ok, err, type Result } from '@nunjucks/shared';

interface CompileToCodeOptions {
  source: string;
  templateName: string;
  undefinedMode: UndefinedMode | undefined;
  parseOpts?: ParseOptions;
}

const compileToCode = ({ source, templateName, undefinedMode, parseOpts }: CompileToCodeOptions): Result<string, Error> => {
  try {
    const compiler = createCompiler(templateName, undefinedMode, source);
    const ast = parse(source, [], parseOpts);
    const transformedAst = transform(ast);
    compiler.compile(transformedAst, createFrame());
    return ok(compiler.getCode());
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
};

export { compileToCode };
