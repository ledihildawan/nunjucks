import type { Classification, ClassifyInput } from './types.ts';

const RESERVED_KEYWORD_CONTEXT: Record<string, { causes: string[]; fixCode: string; fixComment: string }> = {
  caller: {
    causes: [
      '`caller` is a **special macro variable** - only available inside a `call` block',
      'Used to access content from `{% call %}` blocks',
      'Cannot be used outside of macro context'
    ],
    fixCode: `{% macro render(content) %}
  {{ caller() }}
{% endmacro %}

{% call render() %}
  This content will be passed to caller
{% endcall %}`,
    fixComment: 'caller is only available inside macros called with {% call %}'
  },
  super: {
    causes: [
      '`super()` can only be called inside a **block that extends a parent template**',
      'The template must use `{% extends "parent.njk" %}`',
      '`super()` calls the parent template\'s block content'
    ],
    fixCode: '{% extends "parent.njk" %}\n{% block content %}{{ super() }}{% endblock %}',
    fixComment: 'super() requires the template to extend a parent with the block'
  }
};

export const reservedKeywordClassifier = (input: ClassifyInput): Classification | null => {
  if (input.code !== 'RESERVED_KEYWORD_CONTEXT') {
    return null;
  }

  const keyword = input.subject || 'unknown';
  const info = RESERVED_KEYWORD_CONTEXT[keyword] || {
    causes: ['Reserved keyword used outside its context'],
    fixCode: '',
    fixComment: ''
  };

  return {
    category: 'reserved_keyword_context',
    undefinedName: keyword,
    title: `Cannot use reserved keyword '${keyword}' outside of its intended context`,
    ...info
  };
};
