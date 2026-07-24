
import type { Classifier, ClassifyInput, Classification } from './types.ts';
import { firstCapture } from './types.ts';
import { RULES, ERROR_DEFINITIONS, DEFAULT_CLASSIFICATION } from './registry.ts';
import { timeoutClassifier } from './timeout.ts';
import { reservedKeywordClassifier } from './reserved-keyword.ts';

const replacePlaceholders = (
  str: string | null | undefined,
  undefinedName: string | null,
  extra?: Record<string, string | null> | null
): string | null => {
  if (!str) { return str ?? null; }
  let result = str
    .replaceAll('{subject}', undefinedName || '')
    .replaceAll('{target}', undefinedName || '')
    .replaceAll('{name}', undefinedName || '')
    .replaceAll('{key}', undefinedName || '');
  if (extra) {
    for (const key of Object.keys(extra)) {
      const value = extra[key];
      result = result.replaceAll(`{${key}}`, value || '');
    }
  }
  return result;
};

const deriveFromRule = (
  rule: typeof RULES[0],
  input: ClassifyInput
): Classification => {
  const match = input.message?.match(rule.pattern) ?? null;
  let undefinedName: string | null;
  if (match !== null && rule.subjectFrom) {
    undefinedName = rule.subjectFrom(match);
  } else {
    undefinedName = null;
  }
  let extra: Record<string, string | null> | null;
  if (rule.extraFrom) {
    if (match) {
      extra = rule.extraFrom(match);
    } else {
      extra = null;
    }
  } else {
    extra = null;
  }

  let baseCauses: string[];
  if (input.causes && input.causes.length > 0) {
    baseCauses = input.causes;
  } else {
    baseCauses = rule.causes;
  }
  const baseFixCode = input.fixCode ?? rule.fixCode;
  const baseFixComment = input.fixComment ?? rule.fixComment;

  let title: string | null;
  if (rule.titleTemplate) {
    title = replacePlaceholders(rule.titleTemplate, undefinedName, extra);
  } else {
    title = null;
  }

  return {
    category: rule.category,
    undefinedName,
    title,
    causes: baseCauses.map(c => replacePlaceholders(c, undefinedName, extra)).filter((cause): cause is string => cause !== null),
    fixCode: replacePlaceholders(baseFixCode, undefinedName, extra),
    fixComment: replacePlaceholders(baseFixComment, undefinedName, extra),
    documentationUrl: rule.documentationUrl ?? null,
    severity: rule.severity ?? 'error'
  };
};

const codeClassifier: Classifier = (input) => {
  if (!input.code) {
    return null;
  }
  const errorDef = ERROR_DEFINITIONS[input.code as keyof typeof ERROR_DEFINITIONS];
  if (errorDef) {
    return deriveFromRule({
      pattern: errorDef.pattern,
      category: errorDef.category,
      subjectFrom: errorDef.subjectFrom ?? firstCapture,
      extraFrom: errorDef.extraFrom ?? null,
      titleTemplate: errorDef.titleTemplate,
      causes: errorDef.causes,
      fixCode: errorDef.fixCode,
      fixComment: errorDef.fixComment,
      documentationUrl: errorDef.documentationUrl,
      severity: errorDef.severity
    }, input);
  }
  return null;
};

const patternClassifier: Classifier = (input) => {
  for (const rule of RULES) {
    if (rule.pattern.test(input.message || '')) {
      return deriveFromRule(rule, input);
    }
  }
  return null;
};

export const classifiers: Classifier[] = [
  timeoutClassifier,
  reservedKeywordClassifier,
  codeClassifier,
  patternClassifier
];

export const classifyInput = (input: ClassifyInput): Classification => {
  for (const classifier of classifiers) {
    const result = classifier(input);
    if (result) { return result; }
  }
  return DEFAULT_CLASSIFICATION;
};
