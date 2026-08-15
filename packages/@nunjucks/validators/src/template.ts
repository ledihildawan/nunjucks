import { err, ok, type Result } from '@nunjucks/lib';
import type { BaseValidationError } from '@nunjucks/shared';
import { join, map, pipe } from 'remeda';
import { isNonEmpty } from './is-non-empty.ts';
import {
  type DangerousCodeViolation,
  scanTemplateForDangerousCode,
} from './security/template-security.ts';

interface TemplateValidationError extends BaseValidationError {
  code: string;
  subject: string;
  violations?: DangerousCodeViolation[];
}

type TemplateValidationResult = Result<
  void,
  readonly [TemplateValidationError, ...TemplateValidationError[]]
>;

export interface TemplateValidatorConfig {
  maxTemplateSize?: number;
  strictMode?: boolean;
}

const checkTemplateSize = (
  template: string,
  config: TemplateValidatorConfig
): readonly TemplateValidationError[] => {
  if (!config.maxTemplateSize || config.maxTemplateSize <= 0) {
    return [];
  }
  const size = template.length;
  if (size > config.maxTemplateSize) {
    return [
      {
        code: 'TEMPLATE_SIZE_EXCEEDED',
        message: `Template exceeds maximum size of ${config.maxTemplateSize} bytes`,
        subject: 'maxTemplateSize',
      },
    ];
  }
  return [];
};

const checkDangerousCode = (
  template: string,
  config: TemplateValidatorConfig
): readonly TemplateValidationError[] => {
  if (!config.strictMode) {
    return [];
  }
  const violations = scanTemplateForDangerousCode(template);
  if (violations.length === 0) {
    return [];
  }
  const [first] = violations;
  return [
    {
      code: 'DANGEROUS_TEMPLATE_CODE',
      subject: first?.name ?? 'template',
      message: `Template contains dangerous code: ${pipe(
        violations,
        map((v) => v.message),
        join('; ')
      )}`,
      violations,
      lineno: first?.line,
      colno: first?.col,
    },
  ];
};

export const validateTemplate = (
  template: string,
  config: TemplateValidatorConfig
): TemplateValidationResult => {
  const errors = [...checkTemplateSize(template, config), ...checkDangerousCode(template, config)];

  if (!isNonEmpty(errors)) {
    return ok(undefined);
  }
  const [first, ...rest] = errors;
  return err([first, ...rest] as const);
};
