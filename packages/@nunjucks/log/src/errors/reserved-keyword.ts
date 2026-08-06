import type { Classification, ClassifyInput } from './types.ts';

const RESERVED_KEYWORD_CONTEXT: Record<string, { causes: string[]; fixCode: string; fixComment: string }> = {
  slot: {
    causes: [
      '`slot` is a **tag** used to declare slot content inside `{% component %}` and `{% render %}` blocks',
      'Used to declare fallback slots in a component definition',
      'Used to provide named slots in a render invocation'
    ],
    fixCode: `{% component Card %}
  {% slot title %}Default title{% endslot %}
{% endcomponent %}

{% render Card %}
  {% slot title %}Custom title{% endslot %}
{% endrender %}`,
    fixComment: 'slot is only available as a block inside component and render bodies'
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
    documentationUrl: null,
    severity: 'error',
    ...info
  };
};
