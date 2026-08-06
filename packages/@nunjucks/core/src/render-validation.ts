import { validateTemplate, validateConfig, validateRenderContext } from '@nunjucks/validators';
import { createLog, getError, findContextKeyPosition, wrapWithLog } from '@nunjucks/log';
import type { RenderConfig, ValidationError, ValidationErrorRequest } from './render-types.ts';

const createValidationError = async ({
  validationError,
  stamps,
  config,
  templateSource,
  context,
}: ValidationErrorRequest): Promise<never> => {
  const err = createLog(
    'error',
    { name: validationError.code, message: validationError.message },
    undefined,
    (stamps.subject as string | null | undefined) ?? validationError.subject ?? null,
    {
      phase: 'render',
      lineno: (stamps.lineno as number | null | undefined) ?? null,
      colno: (stamps.colno as number | null | undefined) ?? null,
      lineBase: (stamps.lineBase as 'one' | 'zero' | undefined) ?? 'zero',
    },
  );
  throw await wrapWithLog(err, config, templateSource, context);
};

const getDangerousValueStamps = async (contextError: ValidationError, config: RenderConfig): Promise<Record<string, unknown>> => {
  const stamps: Record<string, unknown> = { code: contextError.code };
  const firstDangerousPath = contextError.dangerousPaths?.[0];
  if (!firstDangerousPath) { return stamps; }

  const callerLocation = config._callerLocation;
  if (!callerLocation || callerLocation.fileName === 'unknown') { return stamps; }

  const pos = await findContextKeyPosition(callerLocation.fileName, callerLocation.lineNumber || 1, firstDangerousPath);
  if (pos) {
    stamps.lineno = pos.line;
    stamps.colno = pos.col;
    stamps.lineBase = 'one';
  }
  return stamps;
};

export const validateRender = async (template: unknown, config: RenderConfig, context: unknown): Promise<void> => {
  if (typeof template !== 'string') {
    const err = createLog('error', getError('TEMPLATE_MUST_BE_STRING'), {}, null, { phase: 'render' });
    throw await wrapWithLog(err, config, template as string | null, context);
  }

  const validation = validateConfig(config);
  if (!validation.valid) {
    const ve = validation.errors[0];
    if (ve === undefined) {
      throw createLog('error', { name: 'VALIDATION_ERROR', message: 'Validation failed but no errors found' }, undefined, null, { phase: 'render' });
    }
    const callerLineno = config._callerLocation?.lineNumber;
    const callerColno = config._callerLocation?.columnNumber;
    const resolvedLineno: number | null | undefined = (callerLineno && callerLineno > 1) ? callerLineno - 1 : callerLineno;
    await createValidationError({
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
    });
  }

  const contextValidation = validateRenderContext(context, config);
  if (!contextValidation.valid) {
    const ce = contextValidation.errors[0];
    if (ce === undefined) {
      throw createLog('error', { name: 'VALIDATION_ERROR', message: 'Context validation failed but no errors found' }, undefined, null, { phase: 'render' });
    }
    const stamps = await getDangerousValueStamps(ce, config);
    await createValidationError({ validationError: ce, stamps, config, templateSource: template, context });
  }
};

export const validateTemplateSource = async (templateSource: string, config: RenderConfig, context: unknown): Promise<void> => {
  const templateValidation = validateTemplate(templateSource, config);
  if (!templateValidation.valid) {
    const ve = templateValidation.errors[0];
    await createValidationError({
      validationError: ve,
      stamps: { lineno: ve.lineno, colno: ve.colno, code: ve.code, subject: ve.subject },
      config,
      templateSource,
      context
    });
  }
};
