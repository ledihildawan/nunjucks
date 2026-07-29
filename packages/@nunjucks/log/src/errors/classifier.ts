
import { pipe, keys, reduce } from 'remeda';
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
  const baseResult = str
    .replaceAll('{subject}', undefinedName || '')
    .replaceAll('{target}', undefinedName || '')
    .replaceAll('{name}', undefinedName || '')
    .replaceAll('{key}', undefinedName || '');
  if (!extra) { return baseResult; }
  return pipe(
    extra,
    keys(),
    reduce(
      (acc, key) => acc.replaceAll(`{${key}}`, extra[key] || ''),
      baseResult
    )
  );
};

const mapCauses = (
  causes: readonly string[],
  undefinedName: string | null,
  extra: Record<string, string | null> | null
): string[] =>
  causes.map(c => replacePlaceholders(c, undefinedName, extra)).filter((cause): cause is string => cause !== null);

const extractRuleData = (rule: typeof RULES[0], match: RegExpMatchArray | null) => ({
  undefinedName: match !== null && rule.subjectFrom ? rule.subjectFrom(match) : null,
  extra: rule.extraFrom && match ? rule.extraFrom(match) : null,
});

const buildClassification = (
  rule: typeof RULES[0],
  undefinedName: string | null,
  extra: Record<string, string | null> | null,
  input: ClassifyInput
): Classification => {
  const baseCauses = input.causes?.length ? input.causes : rule.causes;
  const baseFixCode = input.fixCode ?? rule.fixCode;
  const baseFixComment = input.fixComment ?? rule.fixComment;
  const title = rule.titleTemplate ? replacePlaceholders(rule.titleTemplate, undefinedName, extra) : null;

  return {
    category: rule.category,
    undefinedName,
    title,
    causes: mapCauses(baseCauses, undefinedName, extra),
    fixCode: replacePlaceholders(baseFixCode, undefinedName, extra),
    fixComment: replacePlaceholders(baseFixComment, undefinedName, extra),
    documentationUrl: rule.documentationUrl ?? null,
    severity: rule.severity ?? 'error'
  };
};

const deriveFromRule = (
  rule: typeof RULES[0],
  input: ClassifyInput
): Classification => {
  const match = input.message?.match(rule.pattern) ?? null;
  const { undefinedName, extra } = extractRuleData(rule, match);
  return buildClassification(rule, undefinedName, extra, input);
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
  const rule = RULES.find(r => r.pattern.test(input.message || ''));
  return rule ? deriveFromRule(rule, input) : null;
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
