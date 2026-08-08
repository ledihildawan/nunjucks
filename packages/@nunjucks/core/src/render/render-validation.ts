import { validateTemplate, validateConfig, validateRenderContext } from '@nunjucks/validators';
import { createLog, getError } from '@nunjucks/log';
import { findContextKeyPosition, wrapWithLog } from '../diagnostics/diagnostics.ts';
import type { TemplateError } from '@nunjucks/log';
import { ok, err, type Result } from '@nunjucks/shared';
import type { RenderConfig, RenderValidationError, ValidationErrorRequest } from './render-types.ts';

const buildValidationError = async ({
  validationError,
  stamps,
  config,
  templateSource,
  context,
}: ValidationErrorRequest): Promise<TemplateError> => {
  const err = createLog('error', {
    def: { name: validationError.code, message: validationError.message },
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

  const callerLocation = config._callerLocation;
  if (!callerLocation || callerLocation.fileName === 'unknown') { return stamps; }

  const pos = await findContextKeyPosition(callerLocation.fileName, callerLocation.lineNumber ?? 1, firstDangerousPath);
  if (pos) {
    stamps.lineno = pos.line;
    stamps.colno = pos.col;
    stamps.lineBase = 'one';
  }
  return stamps;
};

export const validateRender = async (template: unknown, config: RenderConfig, context: unknown): Promise<Result<void, TemplateError>> => {
  if (typeof template !== 'string') {
    const error = createLog('error', { def: getError('TEMPLATE_MUST_BE_STRING'), params: {}, subject: null, context: { phase: 'render' } });
    return err(await wrapWithLog(error, config, { template: template as string | null, renderContext: context }));
  }

  const validation = validateConfig(config);
  if (!validation.valid) {
    const ve = validation.errors[0];
    if (ve === undefined) {
      // WHY: validators guarantee a non-empty errors tuple when valid===false, so this branch is an impossible-state invariant, not a domain error.
      return err(createLog('error', { def: { name: 'VALIDATION_ERROR', message: 'Validation failed but no errors found' }, subject: null, context: { phase: 'render' } }));
    }
    const callerLineno = config._callerLocation?.lineNumber;
    const callerColno = config._callerLocation?.columnNumber;
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
    const ce = contextValidation.errors[0];
    if (ce === undefined) {
      // WHY: validators guarantee a non-empty errors tuple when valid===false, so this branch is an impossible-state invariant, not a domain error.
      return err(createLog('error', { def: { name: 'VALIDATION_ERROR', message: 'Context validation failed but no errors found' }, subject: null, context: { phase: 'render' } }));
    }
    const stamps = await getDangerousValueStamps(ce, config);
    return err(await buildValidationError({ validationError: ce, stamps, config, templateSource: template, context }));
  }

  return ok(undefined);
};

export const validateTemplateSource = async (templateSource: string, config: RenderConfig, context: unknown): Promise<Result<void, TemplateError>> => {
  const templateValidation = validateTemplate(templateSource, config);
  if (!templateValidation.valid) {
    const ve = templateValidation.errors[0];
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
