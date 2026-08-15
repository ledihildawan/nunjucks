import { createCompiler } from '@nunjucks/compiler';
import { err, isErr, ok, type Result } from '@nunjucks/lib';
import type { ParseOptions, ParserExtension } from '@nunjucks/parser';
import { parse } from '@nunjucks/parser';
import type { UndefinedMode } from '@nunjucks/runtime';
import { createFrame } from '@nunjucks/runtime';
import { transform } from '@nunjucks/transformers';

interface CompileToCodeOptions {
  source: string;
  templateName: string;
  undefinedMode: UndefinedMode | undefined;
  parseOpts?: ParseOptions;
  streamErrorRecovery?: boolean;
  extensions?: readonly ParserExtension[];
}

const compileToCode = ({
  source,
  templateName,
  undefinedMode,
  parseOpts,
  streamErrorRecovery,
  extensions,
}: CompileToCodeOptions): Result<string, Error> => {
  try {
    const compiler = createCompiler({
      templateName,
      undefinedMode,
      source,
      streamErrorRecovery: streamErrorRecovery ?? false,
    });
    const astR = parse(source, { ...parseOpts, extensions });
    if (isErr(astR)) {
      return err(astR.error instanceof Error ? astR.error : new Error(String(astR.error)));
    }
    const transformedAst = transform(astR.value);
    compiler.compile(transformedAst, createFrame());
    return ok(compiler.getCode());
  } catch (error: unknown) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
};

export { compileToCode };
