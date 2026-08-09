import { validateTemplate, validateConfig, validateRenderContext } from '@nunjucks/validators';
import { createLog, getError, ERROR_DEFINITIONS } from '@nunjucks/log';
import { findContextKeyPosition, wrapWithLog } from '../diagnostics/diagnostics.ts';
import type { TemplateError } from '@nunjucks/log';
import { ok, err, type Result } from '@nunjucks/shared';
import type { RenderConfig, RenderValidationError, ValidationErrorRequest } from './render-types.ts';

const combineValidationErrors = <T extends { message: string }>(errors: readonly T[]): T | undefined => {
  const primary = errors[0];
  if (primary === undefined || errors.length === 1) { return primary; }
  const additionalMessages = errors.slice(1).map((e) => e.message).join('; ');
  return { ...primary, message: `${primary.message} (+${errors.length - 1} more: ${additionalMessages})` };
};

const buildValidationError = async ({
  validationError,
  stamps,
  config,
  templateSource,
  context,
}: ValidationErrorRequest): Promise<TemplateError> => {
  // WHY: merge the full catalog definition (causes, fixCode, fixComment, severity) with the validator's already-resolved message. Validators produce plain-text messages, but the catalog template (e.g. "Cannot use reserved {type} '{name}'") would require reconstructing params — overriding message avoids that while still enriching the error with diagnostic metadata.
  const errorCode = validationError.code;
  const catalogDef = errorCode && Object.hasOwn(ERROR_DEFINITIONS, errorCode)
    ? ERROR_DEFINITIONS[errorCode as keyof typeof ERROR_DEFINITIONS]
    : undefined;
  const err = createLog('error', {
    def: catalogDef
      ? { ...catalogDef, message: validationError.message }
      : { name: validationError.code, message: validationError.message },
    subject: (stamps.subject as string | null | undefined) ?? validationError.subject ?? null,
    context: {
      phase: 'render',
      lineno: (stamps.lineno as number | null | undefined) ?? null,
      colno: (stamps.colno as number | null | undefined) ?? null,
      lineBase: (stamps.lineBase as 'one' | 'zero' | undefined) ?? 'zero',
    },
  });
  return wrapWithLog(err, config, { template: templateSource, renderContext: context });
};

const getDangerousValueStamps = async (contextError: RenderValidationError, config: RenderConfig): Promise<Record<string, unknown>> => {
  const stamps: Record<string, unknown> = { code: contextError.code };
  const firstDangerousPath = contextError.dangerousPaths?.[0];
  if (!firstDangerousPath) { return stamps; }

  const callerLocation = config.callerLocation;
  if (!callerLocation || callerLocation.fileName === 'unknown') { return stamps; }

  const pos = await findContextKeyPosition(callerLocation.fileName, callerLocation.lineNumber ?? 1, firstDangerousPath);
  if (pos) {
    stamps.lineno = pos.line;
    stamps.colno = pos.col;
    stamps.lineBase = 'one';
  }
  return stamps;
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
  if (!validation.valid) {
    const ve = combineValidationErrors(validation.errors);
    if (ve === undefined) {
      // WHY: validators guarantee a non-empty errors tuple when valid===false, so this branch is an impossible-state invariant, not a domain error.
      return err(createLog('error', { def: { name: 'VALIDATION_ERROR', message: 'Validation failed but no errors found' }, subject: null, context: { phase: 'render' } }));
    }
    const callerLineno = config.callerLocation?.lineNumber;
    const callerColno = config.callerLocation?.columnNumber;
    // WHY: convert 1-based caller line to 0-based template line (lineBase: 'zero' set in buildValidationError). Guard against lineno === 1 because subtracting would produce 0 which is a valid 0-based index but loses the "first line" semantic for display.
    const resolvedLineno: number | null | undefined = (callerLineno && callerLineno > 1) ? callerLineno - 1 : callerLineno;
    return err(await buildValidationError({
      validationError: ve,
      stamps: {
        code: ve.code,
        subject: ve.subject,
        lineno: resolvedLineno,
        colno: callerColno
      },
      config,
      templateSource: template,
      context
    }));
  }

  const contextValidation = validateRenderContext(context, config);
  if (!contextValidation.valid) {
    const ce = combineValidationErrors(contextValidation.errors);
    if (ce === undefined) {
      // WHY: validators guarantee a non-empty errors tuple when valid===false, so this branch is an impossible-state invariant, not a domain error.
      return err(createLog('error', { def: { name: 'VALIDATION_ERROR', message: 'Context validation failed but no errors found' }, subject: null, context: { phase: 'render' } }));
    }
    const stamps = await getDangerousValueStamps(ce, config);
    return err(await buildValidationError({ validationError: ce, stamps, config, templateSource: template, context }));
  }

  return ok(undefined);
};

export const validateTemplateSource = async (templateSource: string, { config, context }: ValidationOptions): Promise<Result<void, TemplateError>> => {
  const templateValidation = validateTemplate(templateSource, config);
  if (!templateValidation.valid) {
    const ve = combineValidationErrors(templateValidation.errors);
    if (ve === undefined) {
      return err(createLog('error', { def: { name: 'VALIDATION_ERROR', message: 'Template validation failed but no errors found' }, subject: null, context: { phase: 'render' } }));
    }
    return err(await buildValidationError({
      validationError: ve,
      stamps: { lineno: ve.lineno, colno: ve.colno, code: ve.code, subject: ve.subject },
      config,
      templateSource,
      context
    }));
  }

  return ok(undefined);
};
