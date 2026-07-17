const escapeHtml = (str: string): string => {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
};

const renderInlineMarkdown = (text: string): string => {
  if (!text) return '';
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return s;
};

interface SyntaxRule {
  type: string;
  re: RegExp;
  tagOnly?: boolean;
  toggle?: boolean;
}

const SYNTAX_RULES: SyntaxRule[] = [
  { type: 'comment', re: /^\{#[\s\S]*?#\}/ },
  { type: 'tag', re: /^<\/?[a-zA-Z][\w-]*/ },
  { type: 'delimiter', re: /^(?:\{\{|\}\}|\{%|%\})/, toggle: true },
  { type: 'pipe', re: /^\|>/ },
  { type: 'string', re: /^(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/ },
  { type: 'number', re: /^\d+(?:\.\d+)?/ },
  { type: 'attr', re: /^[a-zA-Z_][\w-]*(?=\s*=)/ },
  {
    type: 'keyword',
    re: /^(?:endraw|raw|endfilter|filter|endcall|call|endmacro|macro|endblock|block|endfor|for|endif|elif|else|if|extends|include|import|from|set|with|without|context|as|not|and|or|in|is|true|false|none|null)(?![\w-])/,
    tagOnly: true,
  },
  { type: 'variable', re: /^[a-zA-Z_]\w*/, tagOnly: true },
  { type: 'operator', re: /^(?:\||=|==|!=|<=|>=|<|>|\+|-|\*|\/|%|&|\[|\]|\(|\)|\.|,|:|\?)/ },
];

const highlightHtml = (code: string): string => {
  if (!code) return '';
  let out = '';
  let i = 0;
  let inTag = false;
  const span = (type: string, text: string) => `<span class="syntax-${type}">${escapeHtml(text)}</span>`;
  while (i < code.length) {
    const rest = code.slice(i);
    const ws = rest.match(/^\s+/);
    if (ws) { out += ws[0]; i += ws[0].length; continue; }
    let matched = false;
    for (const rule of SYNTAX_RULES) {
      if (rule.tagOnly && !inTag) continue;
      const m = rest.match(rule.re);
      if (m && m[0]) {
        if (rule.toggle) inTag = (m[0] === '{{' || m[0] === '{%');
        out += span(rule.type, m[0]);
        i += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      const plain = rest.match(/^[^<{}"'|\s]+/);
      if (plain?.[0]) { out += escapeHtml(plain[0]); i += plain[0].length; }
      else { out += escapeHtml(code[i] ?? ''); i += 1; }
    }
  }
  return out;
};

const JS_RULES: SyntaxRule[] = [
  { type: 'comment', re: /^\/\/[^\n]*/ },
  { type: 'comment', re: /^\/\*[\s\S]*?\*\// },
  { type: 'string', re: /^(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/ },
  { type: 'number', re: /^\d+(?:\.\d+)?/ },
  {
    type: 'keyword',
    re: /^(?:function|async|await|try|catch|finally|return|const|let|var|new|throw|typeof|void|delete|class|extends|super|import|export|default|yield|if|else|for|while|do|switch|case|break|continue|this|of|in|instanceof)(?![\w$])/,
  },
  { type: 'variable', re: /^[a-zA-Z_$][\w$]*/ },
  { type: 'operator', re: /^(?:=>|==|!=|<=|>=|&&|\|\||<|>|\+|-|\*|\/|%|&|\||\^|!|=|\?|:|;|,|\.|\(|\)|\[|\]|\{|\})/ },
];

const highlightJs = (code: string): string => {
  if (!code) return '';
  let out = '';
  let i = 0;
  const span = (type: string, text: string) => `<span class="syntax-${type}">${escapeHtml(text)}</span>`;
  while (i < code.length) {
    const rest = code.slice(i);
    const ws = rest.match(/^\s+/);
    if (ws) { out += ws[0]; i += ws[0].length; continue; }
    let matched = false;
    for (const rule of JS_RULES) {
      const m = rest.match(rule.re);
      if (m && m[0]) {
        out += span(rule.type, m[0]);
        i += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) { out += escapeHtml(code[i] ?? ''); i += 1; }
  }
  return out;
};

export { escapeHtml, renderInlineMarkdown, highlightHtml, highlightJs };
