import { filter, join, map, pipe } from 'remeda';
import { scanTemplateForDangerousCode, type DangerousCodeViolation } from '@nunjucks/shared';

export interface TemplateValidationError {
  code: string;
  message: string;
  subject: string;
  violations?: DangerousCodeViolation[];
  lineno?: number;
  colno?: number;
}

export interface TemplateValidationResult {
  valid: boolean;
  errors: TemplateValidationError[];
}

export interface TemplateValidatorConfig {
  maxTemplateSize?: number;
  strictMode?: boolean;
  whitelistStrict?: boolean;
}

const checkTemplateSize = (template: string, config: TemplateValidatorConfig): TemplateValidationError | null => {
  if (!config.maxTemplateSize || config.maxTemplateSize <= 0) {
    return null;
  }
  const size = typeof template === 'string' ? template.length : 0;
  if (size > config.maxTemplateSize) {
    return {
      code: 'TEMPLATE_SIZE_EXCEEDED',
      message: `Template exceeds maximum size of ${config.maxTemplateSize} bytes`,
      subject: 'maxTemplateSize'
    };
  }
  return null;
};

const checkDangerousCode = (template: string, config: TemplateValidatorConfig): TemplateValidationError | null => {
  if (!config.strictMode && !config.whitelistStrict) {
    return null;
  }
  const violations = scanTemplateForDangerousCode(template);
  if (violations.length === 0) {
    return null;
  }
  const [first] = violations;
  return {
    code: 'DANGEROUS_TEMPLATE_CODE',
    subject: first?.name ?? 'template',
    message: `Template contains dangerous code: ${pipe(violations, map(v => v.message), join('; '))}`,
    violations,
    lineno: first?.line,
    colno: first?.col
  };
};

export const validateTemplate = (template: string, config: TemplateValidatorConfig): TemplateValidationResult => {
  const errors = pipe(
    [checkTemplateSize(template, config), checkDangerousCode(template, config)],
    filter((error): error is TemplateValidationError => error !== null)
  );

  return {
    valid: errors.length === 0,
    errors
  };
};
