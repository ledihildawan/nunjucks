import { createCompiler } from '@nunjucks/compiler';
import { parse } from '@nunjucks/parser';
import type { ParseOptions } from '@nunjucks/parser';
import { transform } from '@nunjucks/transformers';
import { createFrame } from '@nunjucks/runtime';
import type { UndefinedMode } from '@nunjucks/runtime';
import { ok, err, isErr, type Result } from '@nunjucks/shared';

interface CompileToCodeOptions {
  source: string;
  templateName: string;
  undefinedMode: UndefinedMode | undefined;
  parseOpts?: ParseOptions;
}

const compileToCode = ({ source, templateName, undefinedMode, parseOpts }: CompileToCodeOptions): Result<string, Error> => {
  try {
    const compiler = createCompiler(templateName, undefinedMode, source);
    const astR = parse(source, [], parseOpts);
    if (isErr(astR)) {
      return err(astR.error instanceof Error ? astR.error : new Error(String(astR.error)));
    }
    const transformedAst = transform(astR.value);
    compiler.compile(transformedAst, createFrame());
    return ok(compiler.getCode());
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
};

export { compileToCode };
