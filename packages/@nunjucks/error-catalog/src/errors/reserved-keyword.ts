import type { Classification, ClassifyInput } from './types.ts';
import { RESERVED_KEYWORD_CONTEXT_TITLE } from './runtime/reference-errors.ts';

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

/**
 * Classifies `RESERVED_KEYWORD_CONTEXT` errors ahead of the generic chain —
 * looks up keyword-specific guidance (e.g. `super`) and falls back to generic
 * reserved-word advice for unknown keywords, rendering the title from the
 * single-sourced title constant.
 */
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
    // WHY: title renders from the SSOT constant in reference-errors.ts — hand-duplicating
    // the string here would drift from RESERVED_KEYWORD_CONTEXT.titleTemplate.
    title: RESERVED_KEYWORD_CONTEXT_TITLE.replaceAll('{subject}', keyword),
    documentationUrl: null,
    severity: 'error',
    ...keywordGuidance,
  };
};
