import { validateTemplate, validateConfig, validateRenderContext } from '@nunjucks/validators';
import { createLog } from '@nunjucks/error-formatter';
import { getError, ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import { findContextKeyPosition, wrapWithLog } from '../diagnostics/diagnostics.ts';
import type { TemplateError } from '@nunjucks/error-formatter';
import { ok, err, isErr, type Result } from '@nunjucks/lib';
import type { RenderConfig, RenderValidationError, ValidationErrorRequest } from './render-types.ts';

const combineValidationErrors = <T extends { message: string }>(errors: readonly [T, ...T[]]): T => {
  const [primary, ...rest] = errors;
  if (rest.length === 0) { return primary; }
  const additionalMessages = rest.map((e) => e.message).join('; ');
  return { ...primary, message: `${primary.message} (+${rest.length} more: ${additionalMessages})` };
};

const buildValidationError = async ({
  validationError,
  stamps: locationMeta,
  config,
  templateSource,
  context,
}: ValidationErrorRequest): Promise<TemplateError> => {
  // WHY: merge the full catalog definition (causes, fixCode, fixComment, severity) with the validator's already-resolved message. Validators produce plain-text messages, but the catalog template (e.g. "Cannot use reserved {type} '{name}'") would require reconstructing params — overriding message avoids that while still enriching the error with diagnostic metadata.
  const errorCode = validationError.code;
  const catalogDef = errorCode && Object.hasOwn(ERROR_DEFINITIONS, errorCode)
    ? ERROR_DEFINITIONS[errorCode as keyof typeof ERROR_DEFINITIONS]
    : undefined;
  const templateError = createLog('error', {
    def: catalogDef
      ? { ...catalogDef, message: validationError.message }
      : { name: validationError.code, message: validationError.message },
    subject: (locationMeta.subject as string | null | undefined) ?? validationError.subject ?? null,
    context: {
      phase: 'render',
      lineno: (locationMeta.lineno as number | null | undefined) ?? null,
      colno: (locationMeta.colno as number | null | undefined) ?? null,
      lineBase: (locationMeta.lineBase as 'one' | 'zero' | undefined) ?? 'zero',
    },
  });
  return wrapWithLog(templateError, config, { template: templateSource, renderContext: context });
};

const getDangerousValueLocationMeta = async (contextError: RenderValidationError, config: RenderConfig): Promise<Record<string, unknown>> => {
  const locationMeta: Record<string, unknown> = { code: contextError.code };
  const firstDangerousPath = contextError.dangerousPaths?.[0];
  if (!firstDangerousPath) { return locationMeta; }

  const callerLocation = config.callerLocation;
  if (!callerLocation || callerLocation.fileName === 'unknown') { return locationMeta; }

  const pos = await findContextKeyPosition({ sourceFile: callerLocation.fileName, callLine: callerLocation.lineNumber ?? 1, dangerousPath: firstDangerousPath });
  if (pos) {
    locationMeta.lineno = pos.line;
    locationMeta.colno = pos.col;
    locationMeta.lineBase = 'one';
  }
  return locationMeta;
};

interface ValidationOptions {
  config: RenderConfig;
  context: unknown;
}

export const validateRender = async (template: unknown, { config, context }: ValidationOptions): Promise<Result<void, TemplateError>> => {
  if (typeof template !== 'string') {
    const error = createLog('error', { def: getError('TEMPLATE_MUST_BE_STRING'), params: {}, subject: null, context: { phase: 'render' } });
    return err(await wrapWithLog(error, config, { template: template as string | null, renderContext: context }));
  }

  const validation = validateConfig(config);
  if (isErr(validation)) {
    const configError = combineValidationErrors(validation.error);
    const callerLineno = config.callerLocation?.lineNumber;
    const callerColno = config.callerLocation?.columnNumber;
    // WHY: convert 1-based caller line to 0-based template line (lineBase: 'zero' set in buildValidationError). Guard against lineno === 1 because subtracting would produce 0 which is a valid 0-based index but loses the "first line" semantic for display.
    const resolvedLineno: number | null | undefined = (callerLineno && callerLineno > 1) ? callerLineno - 1 : callerLineno;
    return err(await buildValidationError({
      validationError: configError,
      stamps: {
        code: configError.code,
        subject: configError.subject,
        lineno: resolvedLineno,
        colno: callerColno
      },
      config,
      templateSource: template,
      context
    }));
  }

  const contextValidation = validateRenderContext(context, config);
  if (isErr(contextValidation)) {
    const contextError = combineValidationErrors(contextValidation.error);
    const locationMeta = await getDangerousValueLocationMeta(contextError, config);
    return err(await buildValidationError({ validationError: contextError, stamps: locationMeta, config, templateSource: template, context }));
  }

  return ok(undefined);
};

export const validateTemplateSource = async (templateSource: string, { config, context }: ValidationOptions): Promise<Result<void, TemplateError>> => {
  const templateValidation = validateTemplate(templateSource, config);
  if (isErr(templateValidation)) {
    const configError = combineValidationErrors(templateValidation.error);
    return err(await buildValidationError({
      validationError: configError,
      stamps: { lineno: configError.lineno, colno: configError.colno, code: configError.code, subject: configError.subject },
      config,
      templateSource,
      context
    }));
  }

  return ok(undefined);
};
