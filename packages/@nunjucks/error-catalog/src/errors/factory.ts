import type { ExtraExtractor } from './types.ts';
import { firstCapture } from './types.ts';
import { escapeRegex } from '@nunjucks/shared';

interface ErrorDefinitionOptions {
  name: string;
  message: string;
  category: string;
  causes: string[];
  fixCode?: string;
  fixComment?: string;
  documentationUrl?: string;
  severity?: 'error' | 'warning' | 'info';
  extraFrom?: ExtraExtractor;
}

const SUPPORTED_PLACEHOLDERS = ['{type}', '{name}', '{key}', '{keys}', '{values}', '{violations}', '{subject}', '{attr}', '{by}', '{path}', '{msg}', '{token}', '{expected}', '{tag}', '{detail}'] as const;

const messageHasVariable = (messageTemplate: string): boolean =>
  SUPPORTED_PLACEHOLDERS.some(placeholder => messageTemplate.includes(placeholder));

const createPattern = (messageTemplate: string): RegExp => {
  const pattern = escapeRegex(messageTemplate)
    .replaceAll('\\{type\\}', '(.+)')
    .replaceAll('\\{name\\}', '([^"\']+)')
    .replaceAll('\\{key\\}', '([^"\']+)')
    .replaceAll('\\{keys\\}', '(.+)')
    .replaceAll('\\{values\\}', '(.+)')
    .replaceAll('\\{violations\\}', '(.+)')
    .replaceAll('\\{subject\\}', '([^"\']+)')
    .replaceAll('\\{attr\\}', '([^"\']+)')
    .replaceAll('\\{by\\}', '(.+)')
    .replaceAll('\\{path\\}', '(.+)')
    .replaceAll('\\{msg\\}', '(.+)')
    .replaceAll('\\{token\\}', '(.+)')
    .replaceAll('\\{expected\\}', '(.+)')
    .replaceAll('\\{tag\\}', '([^"\']+)')
    .replaceAll('\\{detail\\}', '(.+)');
  return new RegExp(`^${pattern}$`, 'i');
};

const createErrorDefinition = (options: ErrorDefinitionOptions) => {
  const { name, message, category, causes, fixCode, fixComment, documentationUrl, severity, extraFrom } = options;

  return {
    name,
    message,
    pattern: createPattern(message),
    category,
    titleTemplate: message,
    causes,
    fixCode,
    fixComment,
    documentationUrl,
    // WHY: severity defaults to 'error' so every factory-created definition has an explicit value. Only warnings (e.g. DANGEROUS_CONTEXT_VALUE_SCRUBBED) override to 'warning'.
    severity: severity ?? 'error',
    subjectFrom: messageHasVariable(message) ? firstCapture : null,
    extraFrom: extraFrom ?? null
  };
};

export { createErrorDefinition };
export type { ErrorDefinitionOptions };
