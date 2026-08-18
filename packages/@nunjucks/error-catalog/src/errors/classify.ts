import { find, keys, map, pipe, reduce } from 'remeda';
import { DEFAULT_CLASSIFICATION, ERROR_DEFINITIONS, RULES, toRule } from './registry.ts';
import { reservedKeywordClassifier } from './reserved-keyword.ts';
import type { Classification, Classifier, ClassifyInput, ErrorSeverity } from './types.ts';

interface ReplacePlaceholdersInput {
  str: string | null | undefined;
  undefinedName: string | null;
  extra?: Record<string, string | null> | null;
}

// WHY: {subject}, {target}, {name}, {key}, {path}, {marker} and {attr} are aliases —
// they all resolve to the same value (the extracted subject from the pattern match).
// This is because catalog definitions use different placeholder names for semantic
// clarity (e.g. "Variable '{name}'" vs "Property '{key}'" vs "template not found:
// {path}") even though the runtime always extracts one subject value — without the
// extended set, those spellings leaked unreplaced into user-facing guidance.
const SUBJECT_PLACEHOLDERS = [
  'subject',
  'target',
  'name',
  'key',
  'path',
  'marker',
  'attr',
] as const;

const replacePlaceholders = ({
  str,
  undefinedName,
  extra,
}: ReplacePlaceholdersInput): string | null => {
  if (!str) {
    return str ?? null;
  }
  const replacement = undefinedName ?? '';
  let result = str;
  for (const p of SUBJECT_PLACEHOLDERS) {
    result = result.replaceAll(`{${p}}`, replacement);
  }
  if (!extra) {
    return result;
  }
  return pipe(
    extra,
    keys(),
    reduce((acc, key) => acc.replaceAll(`{${key}}`, extra[key] ?? ''), result)
  );
};

interface MapCausesOptions {
  causes: readonly string[];
  undefinedName: string | null;
  extra: Record<string, string | null> | null;
}

const mapCauses = ({ causes, undefinedName, extra }: MapCausesOptions): string[] =>
  causes
    .map((cause) => replacePlaceholders({ str: cause, undefinedName, extra }))
    .filter((cause): cause is string => cause !== null);

const extractRuleData = (rule: (typeof RULES)[0], match: RegExpMatchArray | null) => ({
  undefinedName: match !== null && rule.subjectFrom ? rule.subjectFrom(match) : null,
  extra: rule.extraFrom && match ? rule.extraFrom(match) : null,
});

interface BuildClassificationOptions {
  rule: (typeof RULES)[0];
  undefinedName: string | null;
  extra: Record<string, string | null> | null;
  input: ClassifyInput;
}

const buildClassification = ({
  rule,
  undefinedName,
  extra,
  input,
}: BuildClassificationOptions): Classification => {
  // WHY: prefer the error's explicit subject over the pattern-extracted name for placeholder substitution. The pattern match captures the full expression from the message text (e.g. 'user["status"]()'), while the runtime-set subject is the precise reference (e.g. 'user["status"]'). Using the pattern match would produce incorrect fixCode like `typeof user["status"]()()` with doubled parens.
  const effectiveSubject = input.subject ?? undefinedName;
  const baseCauses = input.causes?.length ? input.causes : rule.causes;
  const baseFixCode = input.fixCode ?? rule.fixCode;
  const baseFixComment = input.fixComment ?? rule.fixComment;
  const title = rule.titleTemplate
    ? replacePlaceholders({ str: rule.titleTemplate, undefinedName: effectiveSubject, extra })
    : null;

  return {
    category: rule.category,
    undefinedName: effectiveSubject,
    title,
    causes: mapCauses({ causes: baseCauses, undefinedName: effectiveSubject, extra }),
    fixCode: replacePlaceholders({ str: baseFixCode, undefinedName: effectiveSubject, extra }),
    fixComment: replacePlaceholders({
      str: baseFixComment,
      undefinedName: effectiveSubject,
      extra,
    }),
    documentationUrl: rule.documentationUrl ?? null,
    severity: rule.severity ?? 'error',
  };
};

const deriveFromRule = (rule: (typeof RULES)[0], input: ClassifyInput): Classification => {
  const match = input.message?.match(rule.pattern) ?? null;
  const { undefinedName, extra } = extractRuleData(rule, match);
  return buildClassification({ rule, undefinedName, extra, input });
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
  const rule = RULES.find((candidate) => candidate.pattern.test(input.message ?? ''));
  return rule ? deriveFromRule(rule, input) : null;
};

// WHY: RULES patterns are anchored with greedy wildcards; against a pathologically long
// message (error text embeds template-controlled values) the pattern loop degrades to
// polynomial backtracking. Oversized messages skip regex classification entirely —
// code-based classification still runs, since it never needs the message text to look up
// its definition.
const MAX_CLASSIFY_MESSAGE_LENGTH = 4096;

const classifiers: Classifier[] = [reservedKeywordClassifier, codeClassifier, patternClassifier];

const classifyInput = (input: ClassifyInput): Classification => {
  const boundedInput =
    input.message !== undefined && input.message.length > MAX_CLASSIFY_MESSAGE_LENGTH
      ? { ...input, message: undefined }
      : input;
  return (
    pipe(
      classifiers,
      map((classifier) => classifier(boundedInput)),
      find((result): result is Classification => result !== null)
    ) ?? DEFAULT_CLASSIFICATION
  );
};

interface ErrorWithExtras {
  message?: string;
  code?: string | null;
  subject?: string | null;
  causes?: string[];
  fixCode?: string | null;
  fixComment?: string | null;
  documentationUrl?: string | null;
  severity?: ErrorSeverity;
}

/**
 * Classifies any error-like value through the classifier chain (reserved
 * keyword, code lookup, then pattern match) without throwing. A `null` input
 * yields the unknown classification, unmatched input falls back to
 * `DEFAULT_CLASSIFICATION`, and oversized messages skip regex classification.
 */
export const classifyFromError = (error: ErrorWithExtras | null): Classification => {
  if (!error) {
    return {
      category: 'unknown',
      undefinedName: null,
      causes: ['Unknown error occurred'],
      fixCode: null,
      fixComment: null,
      documentationUrl: null,
      severity: 'error',
    };
  }
  return classifyInput({
    message: error.message,
    code: error.code,
    subject: error.subject,
    causes: error.causes,
    fixCode: error.fixCode ?? undefined,
    fixComment: error.fixComment ?? undefined,
  });
};
