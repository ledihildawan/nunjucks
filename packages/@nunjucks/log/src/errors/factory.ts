import type { SubjectExtractor, ExtraExtractor } from './types.ts';
import { firstCapture } from './types.ts';

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

const createPattern = (messageTemplate: string): RegExp => {
  const pattern = messageTemplate
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replaceAll('\\{type\\}', '(.+)')
    .replaceAll('\\{name\\}', '([^"]+)')
    .replaceAll('\\{key\\}', '([^"]+)')
    .replaceAll('\\{keys\\}', '(.+)')
    .replaceAll('\\{values\\}', '(.+)')
    .replaceAll('\\{violations\\}', '(.+)')
    .replaceAll('\\{subject\\}', '([^"]+)')
    .replaceAll('\\{attr\\}', '([^"]+)')
    .replaceAll('\\{by\\}', '(.+)');
  return new RegExp(`^${pattern}$`, 'i');
};

const createErrorDefinition = (options: ErrorDefinitionOptions) => {
  const { name, message, category, causes, fixCode, fixComment, documentationUrl, severity, extraFrom } = options;
  const hasVariable = message.includes('{type}') || message.includes('{name}') || message.includes('{key}') || message.includes('{keys}') || message.includes('{values}') || message.includes('{violations}') || message.includes('{subject}') || message.includes('{attr}') || message.includes('{by}');

  let subjectFrom: SubjectExtractor | null = null;
  if (hasVariable) {
    subjectFrom = firstCapture;
  }

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
    severity,
    subjectFrom,
    extraFrom: extraFrom ?? null
  };
};

export { createErrorDefinition };
export type { ErrorDefinitionOptions };
