
import { pipe, keys, reduce, find, map } from 'remeda';
import type { Classifier, ClassifyInput, Classification } from './types.ts';
import { RULES, ERROR_DEFINITIONS, DEFAULT_CLASSIFICATION, toRule } from './registry.ts';
import { reservedKeywordClassifier } from './reserved-keyword.ts';

const replacePlaceholders = (
  str: string | null | undefined,
  undefinedName: string | null,
  extra?: Record<string, string | null> | null
): string | null => {
  if (!str) { return str ?? null; }
  const baseResult = str
    .replaceAll('{subject}', undefinedName ?? '')
    .replaceAll('{target}', undefinedName ?? '')
    .replaceAll('{name}', undefinedName ?? '')
    .replaceAll('{key}', undefinedName ?? '');
  if (!extra) { return baseResult; }
  return pipe(
    extra,
    keys(),
    reduce(
      (acc, key) => acc.replaceAll(`{${key}}`, extra[key] ?? ''),
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
  // WHY: prefer the error's explicit subject over the pattern-extracted name for placeholder substitution. The pattern match captures the full expression from the message text (e.g. 'user["status"]()'), while the runtime-set subject is the precise reference (e.g. 'user["status"]'). Using the pattern match would produce incorrect fixCode like `typeof user["status"]()()` with doubled parens.
  const effectiveSubject = input.subject ?? undefinedName;
  const baseCauses = input.causes?.length ? input.causes : rule.causes;
  const baseFixCode = input.fixCode ?? rule.fixCode;
  const baseFixComment = input.fixComment ?? rule.fixComment;
  const title = rule.titleTemplate ? replacePlaceholders(rule.titleTemplate, effectiveSubject, extra) : null;

  return {
    category: rule.category,
    undefinedName: effectiveSubject,
    title,
    causes: mapCauses(baseCauses, effectiveSubject, extra),
    fixCode: replacePlaceholders(baseFixCode, effectiveSubject, extra),
    fixComment: replacePlaceholders(baseFixComment, effectiveSubject, extra),
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
    return deriveFromRule(toRule(errorDef), input);
  }
  return null;
};

const patternClassifier: Classifier = (input) => {
  const rule = RULES.find(r => r.pattern.test(input.message ?? ''));
  return rule ? deriveFromRule(rule, input) : null;
};

export const classifiers: Classifier[] = [
  reservedKeywordClassifier,
  codeClassifier,
  patternClassifier
];

export const classifyInput = (input: ClassifyInput): Classification =>
  pipe(
    classifiers,
    map((classifier) => classifier(input)),
    find((result): result is Classification => result !== null)
  ) ?? DEFAULT_CLASSIFICATION;

interface ErrorWithExtras {
  message?: string;
  code?: string | null;
  subject?: string | null;
  causes?: string[];
  fixCode?: string | null;
  fixComment?: string | null;
  documentationUrl?: string | null;
  severity?: 'error' | 'warning' | 'info';
}

export const classifyFromError = (error: ErrorWithExtras | null): Classification => {
  if (!error) {
    return {
      category: 'unknown',
      undefinedName: null,
      causes: ['Unknown error occurred'],
      fixCode: null,
      fixComment: null,
      documentationUrl: null,
      severity: 'error'
    };
  }
  return classifyInput({
    message: error.message,
    code: error.code,
    subject: error.subject,
    causes: error.causes,
    fixCode: error.fixCode ?? undefined,
    fixComment: error.fixComment ?? undefined
  });
};
