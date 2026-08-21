import { createCompiler } from '@nunjucks/compiler';
import { err, isErr, ok, type Result } from '@nunjucks/lib';
import type { ParseOptions, ParserExtension } from '@nunjucks/parser';
import { parse } from '@nunjucks/parser';
import { createFrame } from '@nunjucks/runtime';
import type { UndefinedMode } from '@nunjucks/shared';
import { transform } from '@nunjucks/transformers';
import { isParserExtensionShape, type ExpressionSecurityConfig } from '@nunjucks/validators';

// WHY: branding-only refinement — the shape test itself is the validators SSOT
// (isParserExtensionShape), shared with config validation so the boundary check
// and this filter can never drift apart.
const isParserExtension = (value: unknown): value is ParserExtension =>
  isParserExtensionShape(value);

// WHY: converts config.extensions (name → ext object map) into the ParserExtension[]
// the parser expects — each value carries `tags` + `parse`; the map key is the lookup
// name used by env.getExtension at runtime. Malformed entries are rejected at the
// factory/render boundary (validateExtensions); this filter stays as a defensive
// backstop for paths that bypass config validation.
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
