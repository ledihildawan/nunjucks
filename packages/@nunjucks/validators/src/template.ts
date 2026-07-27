interface DangerousCodeViolation {
  message: string;
  pattern: string;
  line: number;
  col: number;
  name: string | null;
}

// Hoisted so each pattern is compiled once rather than on every scan.
const DANGEROUS_PATTERNS: ReadonlyArray<{ pattern: RegExp; message: string }> = [
  { pattern: /\beval\s*\(/, message: 'eval() is not allowed' },
  { pattern: /\bFunction\s*\(/, message: 'Function constructor is not allowed' },
  { pattern: /\brequire\s*\(/, message: 'require() is not allowed' },
  { pattern: /\bimport\s+\(/, message: 'dynamic import() is not allowed' },
];

const IDENTIFIER_RE = /[a-zA-Z_$][\w$]*/;

const scanTemplateForDangerousCode = (templateContent: string): DangerousCodeViolation[] => {
  const violations: DangerousCodeViolation[] = [];

  for (const { pattern, message } of DANGEROUS_PATTERNS) {
    const regex = new RegExp(pattern.source, 'g');
    let match: RegExpExecArray | null;
    for (;;) {
      match = regex.exec(templateContent);
      if (match === null) { break; }
      const beforeMatch = templateContent.slice(0, match.index);
      const lines = beforeMatch.split('\n');
      const line = lines.length;
      const col = lines.at(-1)?.length ?? 0;
      const nameMatch = match[0].match(IDENTIFIER_RE);
      let name: string | null = null;
      if (nameMatch) {
        const [firstMatch] = nameMatch;
        name = firstMatch;
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
    message: `Template contains dangerous code: ${violations.map(v => v.message).join('; ')}`,
    violations,
    lineno: first?.line,
    colno: first?.col
  };
};

export const validateTemplate = (template: string, config: TemplateValidatorConfig): TemplateValidationResult => {
  const errors: TemplateValidationError[] = [];

  const sizeError = checkTemplateSize(template, config);
  if (sizeError) {
    errors.push(sizeError);
  }

  const dangerousError = checkDangerousCode(template, config);
  if (dangerousError) {
    errors.push(dangerousError);
  }

  return {
    valid: errors.length === 0,
    errors
  };
};
