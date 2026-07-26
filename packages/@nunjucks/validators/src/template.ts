interface DangerousCodeViolation {
  message: string;
  pattern: string;
  line: number;
  col: number;
  name: string | null;
}

const scanTemplateForDangerousCode = (templateContent: string): DangerousCodeViolation[] => {
  const DangerousPatterns = [
    { pattern: /\beval\s*\(/, message: 'eval() is not allowed' },
    { pattern: /\bFunction\s*\(/, message: 'Function constructor is not allowed' },
    { pattern: /\brequire\s*\(/, message: 'require() is not allowed' },
    { pattern: /\bimport\s+\(/, message: 'dynamic import() is not allowed' },
  ];

  const violations: DangerousCodeViolation[] = [];

  for (const { pattern, message } of DangerousPatterns) {
    const regex = new RegExp(pattern.source, 'g');
    let match: RegExpExecArray | null;
    for (;;) {
      match = regex.exec(templateContent);
      if (match === null) { break; }
      const beforeMatch = templateContent.slice(0, match.index);
      const lines = beforeMatch.split('\n');
      const line = lines.length;
      const col = lines.at(-1)?.length ?? 0;
      const nameMatch = match[0].match(/[a-zA-Z_$][\w$]*/);
      let name: string | null = null;
      if (nameMatch) {
        name = nameMatch[0];
      }
      violations.push({ message, pattern: pattern.source, line, col, name });
    }
  }

  return violations;
};

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

export const validateTemplate = (template: string, config: TemplateValidatorConfig): TemplateValidationResult => {
  const errors: TemplateValidationError[] = [];

  if (config.maxTemplateSize && config.maxTemplateSize > 0) {
    let size: number;
    if (typeof template === 'string') {
      size = template.length;
    } else {
      size = 0;
    }
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
        subject: first?.name ?? 'template',
        message: `Template contains dangerous code: ${violations.map(v => v.message).join('; ')}`,
        violations,
        lineno: first?.line,
        colno: first?.col
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
};
