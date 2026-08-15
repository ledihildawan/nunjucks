import type { Classification, ClassifyInput } from './types.ts';

const RESERVED_KEYWORD_CONTEXT: Record<
  string,
  { causes: string[]; fixCode: string; fixComment: string }
> = {
  super: {
    causes: [
      '`super()` can only be called inside a **block that extends a parent template**',
      'The template must use `{% extends "parent.njk" %}`',
      "`super()` calls the parent template's block content",
    ],
    fixCode: '{% extends "parent.njk" %}\n{% block content %}{{ super() }}{% endblock %}',
    fixComment: 'super() requires the template to extend a parent with the block',
  },
};

export const reservedKeywordClassifier = (input: ClassifyInput): Classification | null => {
  if (input.code !== 'RESERVED_KEYWORD_CONTEXT') {
    return null;
  }

  const keyword = input.subject ?? 'unknown';
  const keywordGuidance = RESERVED_KEYWORD_CONTEXT[keyword] || {
    causes: [
      'This word is reserved by the nunjucks parser and cannot be used as a variable, filter, or function name',
      'Each reserved keyword has a specific context where it is valid (see nunjucks documentation)',
    ],
    fixCode: '// Rename to avoid the reserved keyword — e.g. myFn() instead of fn()',
    fixComment:
      "Use a non-reserved name for your variable, filter, or function. Common alternatives: 'fn' → 'call', 'import' → 'load', 'export' → 'save'",
  };

  return {
    category: 'reserved_keyword_context',
    undefinedName: keyword,
    title: `Cannot use reserved keyword '${keyword}' outside of its intended context`,
    documentationUrl: null,
    severity: 'error',
    ...keywordGuidance,
  };
};
