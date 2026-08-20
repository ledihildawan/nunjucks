/**
 * Data tables for the syntax highlighters — declarative rule lists only; scanning
 * and colorizing logic lives in `highlight.ts`.
 */
interface SyntaxRule {
  type: string;
  re: RegExp;
  tagOnly?: boolean;
  toggle?: boolean;
}

const SYNTAX_RULES: SyntaxRule[] = [
  { type: 'comment', re: /^\{#[\s\S]*?#\}/u },
  { type: 'tag', re: /^<\/?[a-zA-Z][\w-]*/u },
  { type: 'delimiter', re: /^(?:\{\{|\}\}|\{%|%\})/u, toggle: true },
  { type: 'pipe', re: /^\|>/u },
  { type: 'string', re: /^(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/u },
  { type: 'number', re: /^\d+(?:\.\d+)?/u },
  { type: 'attr', re: /^[a-zA-Z_][\w-]*(?=\s*=)/u },
  {
    type: 'keyword',
    // WHY: kept in sync BY HAND with the statement-tag grammar in
    // parser/src/statement-parser/registry.ts — error-renderer cannot import it without
    // creating a package cycle (parser → error-formatter → error-renderer). The alternation
    // covers: registry tags + their end-tags and sub-clause keywords (case/default/when),
    // the lexer's raw aliases (raw/verbatim), and clause keywords (with/without/context/as).
    // When adding a new {% tag %} to the parser, add it here too or it will not highlight.
    re: /^(?:endverbatim|verbatim|endraw|raw|endfilter|filter|endcomponent|component|endrender|render|endslot|slot|endblock|block|endfor|for|endif|elif|else|if|endswitch|switch|case|default|exec|endscope|scope|endmatch|match|when|endcapture|capture|extends|include|import|from|with|without|context|as|not|and|or|in|is|true|false|none|null)(?![\w-])/u,
    tagOnly: true,
  },
  { type: 'variable', re: /^[a-zA-Z_]\w*/u, tagOnly: true },
  { type: 'operator', re: /^(?:\||=|==|!=|<=|>=|<|>|\+|-|\*|\/|%|&|\[|\]|\(|\)|\.|,|:|\?)/u },
];

const JS_RULES: SyntaxRule[] = [
  { type: 'comment', re: /^\/\/[^\n]*/u },
  { type: 'comment', re: /^\/\*[\s\S]*?\*\//u },
  {
    type: 'string',
    re: /^(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|$'(?:[^'\\]|\\.)*')/u,
  },
  { type: 'number', re: /^\d+(?:\.\d+)?/u },
  {
    type: 'keyword',
    re: /^(?:function|async|await|try|catch|finally|return|const|let|var|new|throw|typeof|void|delete|class|extends|super|import|export|default|yield|if|else|for|while|do|switch|case|break|continue|this|of|in|instanceof|type|enum|interface|namespace|module|declare|abstract|implements|public|private|protected|readonly|static|get|set|asserts|infer|keyof|never|unknown|any|debugger|with|as)(?![\w$])/u,
  },
  { type: 'variable', re: /^[a-zA-Z_$][\w$]*/u },
  {
    type: 'operator',
    re: /^(?:=>|==|!=|<=|>=|&&|\|\||<|>|\+|-|\*|\/|%|&|\||\^|!|=|\?|:|;|,|\.|\(|\)|\[|\]|\{|\}|\.\.\.)/u,
  },
];

const CSS_RULES: SyntaxRule[] = [
  { type: 'comment', re: /^\/\*[\s\S]*?\*\//u },
  { type: 'string', re: /^"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/u },
  {
    type: 'number',
    re: /^(?:\d+(?:\.\d+)?(?:px|em|rem|vh|vw|ch|ex|cm|mm|in|pt|pc|deg|rad|grad|turn|s|ms|%)?|\d+(?:\.\d+)?)/u,
  },
  {
    type: 'keyword',
    re: /^(?:inherit|initial|unset|none|auto|normal|bold|italic|underline|overline|line-through|blink|hidden|scroll|auto|static|relative|absolute|fixed|sticky|block|inline|inline-block|flex|inline-flex|grid|inline-grid|table|inline-table|list-item|run-in|compact|contents|table-row|table-cell|table-row-group|table-header-group|table-footer-group|table-column|table-column-group|table-caption|separate|collapse|transparent|solid|double|groove|ridge|inset|outset|dotted|dashed|center|left|right|justify|both|freeze|print|page|always|avoid|avoid-page|avoid-column|avoid-page)(?![\w-])/u,
  },
  { type: 'variable', re: /^--[\w-]*/u },
  { type: 'attr', re: /^[\w-]+(?=\s*:)/u },
  { type: 'selector', re: /^[.#][\w-]+/u },
  { type: 'operator', re: /^[{}()[\]:;,>+~]/u },
];

export type { SyntaxRule };
export { CSS_RULES, JS_RULES, SYNTAX_RULES };
