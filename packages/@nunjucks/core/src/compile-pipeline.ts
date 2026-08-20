import { createCompiler } from '@nunjucks/compiler';
import { err, isErr, isKeyedObject, ok, type Result } from '@nunjucks/lib';
import type { ParseOptions, ParserExtension } from '@nunjucks/parser';
import { parse } from '@nunjucks/parser';
import { createFrame } from '@nunjucks/runtime';
import type { UndefinedMode } from '@nunjucks/shared';
import { transform } from '@nunjucks/transformers';
import type { ExpressionSecurityConfig } from '@nunjucks/validators';

const isParserExtension = (value: unknown): value is ParserExtension =>
  isKeyedObject(value) && Array.isArray(value.tags) && typeof value.parse === 'function';

// WHY: converts config.extensions (name → ext object map) into the ParserExtension[]
// the parser expects — each value carries `tags` + `parse`; the map key is the lookup
// name used by env.getExtension at runtime. Non-conforming values are dropped silently
// and purely here; a malformed extension therefore surfaces later as a parse-time
// "unknown block tag" error, not at factory creation — keep extension objects
// well-formed (tags: string[], parse/run callables).
const resolveParserExtensions = (
  extensions: Readonly<Record<string, unknown>> | undefined
): readonly ParserExtension[] | undefined =>
  extensions ? Object.values(extensions).filter(isParserExtension) : undefined;

interface CompileToCodeOptions {
  source: string;
  templateName: string;
  undefinedMode: UndefinedMode | undefined;
  parseOpts?: ParseOptions;
  streamErrorRecovery?: boolean;
  extensions?: readonly ParserExtension[];
  /** Pass-through to parseOpts.security for compile-time expression validation. */
  expressionSecurity?: ExpressionSecurityConfig;
}

/**
 * Compiles template source to executable JS code — parse, transform, codegen —
 * folding every stage's failure into a `Result` instead of throwing.
 */
const compileToCode = ({
  source,
  templateName,
  undefinedMode,
  parseOpts,
  streamErrorRecovery,
  extensions,
  expressionSecurity,
}: CompileToCodeOptions): Result<string, Error> => {
  try {
    const compiler = createCompiler({
      templateName,
      undefinedMode,
      source,
      streamErrorRecovery: streamErrorRecovery ?? false,
    });
    const astR = parse(source, {
      ...parseOpts,
      extensions,
      security: expressionSecurity ?? parseOpts?.security,
    });
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

export { compileToCode, resolveParserExtensions };
