import { escapeRegex } from '@nunjucks/lib';
import type { ExtraExtractor } from './types.ts';
import type { ErrorSeverity } from './types.ts';
import { firstCapture } from './types.ts';

interface ErrorDefinitionOptions {
  name: string;
  message: string;
  category: string;
  causes: string[];
  fixCode?: string;
  fixComment?: string;
  documentationUrl?: string;
  severity?: ErrorSeverity;
  extraFrom?: ExtraExtractor;
}

// WHY: single source of truth for placeholder → regex capture group mapping. Adding a new placeholder requires ONE entry here — no parallel list to keep in sync. Identifiers (name, key, subject, attr, tag) use [^"']+ to avoid matching quoted strings; free-form values (type, path, msg, etc.) use .+ for broad matching.
const PLACEHOLDER_PATTERNS: ReadonlyArray<{
  readonly placeholder: string;
  readonly capture: string;
}> = [
  { placeholder: '{type}', capture: '(.+)' },
  { placeholder: '{name}', capture: '([^"\']+)' },
  { placeholder: '{key}', capture: '([^"\']+)' },
  { placeholder: '{keys}', capture: '(.+)' },
  { placeholder: '{values}', capture: '(.+)' },
  { placeholder: '{violations}', capture: '(.+)' },
  { placeholder: '{subject}', capture: '([^"\']+)' },
  { placeholder: '{attr}', capture: '([^"\']+)' },
  { placeholder: '{by}', capture: '(.+)' },
  { placeholder: '{path}', capture: '(.+)' },
  { placeholder: '{msg}', capture: '(.+)' },
  { placeholder: '{token}', capture: '(.+)' },
  { placeholder: '{expected}', capture: '(.+)' },
  { placeholder: '{tag}', capture: '([^"\']+)' },
  { placeholder: '{detail}', capture: '(.+)' },
];

const messageHasVariable = (messageTemplate: string): boolean =>
  PLACEHOLDER_PATTERNS.some(({ placeholder }) => messageTemplate.includes(placeholder));

const createPattern = (messageTemplate: string): RegExp => {
  const pattern = PLACEHOLDER_PATTERNS.reduce(
    (acc, { placeholder, capture }) => acc.replaceAll(escapeRegex(placeholder), capture),
    escapeRegex(messageTemplate)
  );
  return new RegExp(`^${pattern}$`, 'i');
};

/**
 * Builds a complete `ErrorDefinition` from options — derives the anchored,
 * case-insensitive matching `pattern` by expanding the message's
 * `{placeholder}` params into capture groups, and defaults `severity` to
 * `'error'` so every definition carries an explicit value.
 */
const createErrorDefinition = (options: ErrorDefinitionOptions) => {
  const {
    name,
    message,
    category,
    causes,
    fixCode,
    fixComment,
    documentationUrl,
    severity,
    extraFrom,
  } = options;

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
    // WHY: severity defaults to 'error' so every factory-created definition carries an
    // explicit value; warnings opt out via severity: 'warning' in their definitions.
    severity: severity ?? 'error',
    subjectFrom: messageHasVariable(message) ? firstCapture : null,
    extraFrom: extraFrom ?? null,
  };
};

export { createErrorDefinition };
