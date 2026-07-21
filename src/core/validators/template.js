import { scanTemplateForDangerousCode } from '@nunjucks/runtime/security';

export const validateTemplate = (template, config) => {
  const errors = [];

  if (config.maxTemplateSize > 0) {
    const size = typeof template === 'string' ? template.length : 0;
    if (size > config.maxTemplateSize) {
      errors.push({
        code: 'TEMPLATE_SIZE_EXCEEDED',
        message: `Template exceeds maximum size of ${config.maxTemplateSize} bytes`,
        subject: 'maxTemplateSize'
      });
    }
  }

  if (config.strictMode || config.whitelistStrict) {
    const violations = scanTemplateForDangerousCode(template);
    if (violations.length > 0) {
      const first = violations[0];
      errors.push({
        code: 'DANGEROUS_TEMPLATE_CODE',
        subject: first.name ?? 'template',
        message: `Template contains dangerous code: ${violations.map(v => v.message).join('; ')}`,
        violations,
        lineno: first.line,
        colno: first.col
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
};
