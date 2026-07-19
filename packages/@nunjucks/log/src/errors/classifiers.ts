import type { Classifier, ClassifyInput, Classification, SubjectExtractor } from './types.ts';
import { RULES, ERROR_DEFINITIONS, DEFAULT_CLASSIFICATION } from './registry.ts';
import { timeoutClassifier } from './timeout.ts';
import { reservedKeywordClassifier } from './reserved-keyword.ts';

const firstCapture: SubjectExtractor = (groups) => groups[1] ?? null;

const replacePlaceholders = (
  str: string | null | undefined,
  undefinedName: string | null,
  extra?: Record<string, string | null>
): string | null => {
  if (!str) return str ?? null;
  let result = str.replaceAll('{subject}', undefinedName || '').replaceAll('{target}', undefinedName || '');
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
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
  const undefinedName = match != null && rule.subjectFrom ? rule.subjectFrom(match) : null;
  const extra = rule.extraFrom ? (match ? rule.extraFrom(match) : null) : null;

  return {
    category: rule.category,
    undefinedName,
    title: rule.titleTemplate ? replacePlaceholders(rule.titleTemplate, undefinedName, extra) : null,
    causes: rule.causes.map(c => replacePlaceholders(c, undefinedName, extra)).filter((cause): cause is string => cause !== null),
    fixCode: replacePlaceholders(rule.fixCode, undefinedName, extra),
    fixComment: replacePlaceholders(rule.fixComment, undefinedName, extra)
  };
};

const codeClassifier: Classifier = (input) => {
  if (!input.code) {
    console.log('codeClassifier: no code in input');
    return null;
  }
  const errorDef = ERROR_DEFINITIONS[input.code as keyof typeof ERROR_DEFINITIONS];
  console.log('codeClassifier: input.code =', input.code, 'errorDef =', errorDef);
  if (errorDef) {
    return deriveFromRule({
      pattern: errorDef.pattern,
      category: errorDef.category,
      subjectFrom: errorDef.subjectFrom ?? firstCapture,
      extraFrom: errorDef.extraFrom ?? null,
      titleTemplate: errorDef.titleTemplate,
      causes: errorDef.causes,
      fixCode: errorDef.fixCode,
      fixComment: errorDef.fixComment
    }, input);
  }
  console.log('codeClassifier: errorDef not found for', input.code);
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
    if (result) return result;
  }
  return DEFAULT_CLASSIFICATION;
};
