// WHY: Lib-tier placement — these encoders are pure, stateless, and multi-consumer
// (runtime escaping, filters, error-renderer, samples). Relocating them into runtime
// would force every non-runtime consumer to depend on the runtime package (a DAG
// inversion), so the context-aware encoding policy stays in the portability tier.
/**
 * Escapes `&`, `<`, `>`, `"`, `'`, and `\` into HTML entities for text and
 * quoted-attribute markup contexts. Not safe for unquoted attribute values —
 * use `escapeUnquotedAttribute` there.
 */
const escapeHtml = (str: string): string => {
  const htmlEscaped = str.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return htmlEscaped.replaceAll('"', '&quot;').replaceAll("'", '&#39;').replaceAll('\\', '&#92;');
};

/**
 * Escapes a quoted HTML attribute value: the same entity set as `escapeHtml`
 * except the backslash pass is swapped for a backtick pass.
 *
 * WHY: deliberate hardening, not parity — nunjucks-original has a single
 * `escape` (backslash → `&#92;`, no backtick) used for both text and
 * attributes. Here the backtick is entity-encoded because it is an attribute-
 * context metacharacter: it terminates none of the HTML quote styles but IS
 * consumed by template literals and legacy/unquoted attribute parsing, so
 * `&#96;` blocks template-literal breakout when a value flows from an
 * attribute into a JS string. Backslash is intentionally NOT escaped —
 * browsers give it no escape meaning inside attribute values (unlike JS
 * string literals), so encoding it would be inert noise.
 */
const escapeAttribute = (str: string): string => {
  const htmlEscaped = str.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return htmlEscaped.replaceAll('"', '&quot;').replaceAll("'", '&#39;').replaceAll('`', '&#96;');
};

/**
 * Escapes a string for embedding inside a quoted JavaScript string literal in
 * a `<script>` block: backslash and quotes are escaped, control characters
 * become escape sequences, and `<`/`>` become `\u003c`/`\u003e` so the
 * literal cannot close the tag early.
 */
const escapeScriptString = (str: string): string => {
  const backslashEscaped = str
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll("'", "\\'");
  const controlEscaped = backslashEscaped
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')
    .replaceAll('\t', '\\t');
  return controlEscaped.replaceAll('<', '\\u003c').replaceAll('>', '\\u003e');
};

// WHY: inside a <style> context browsers decode CSS escapes (\XX hex), not HTML entities,
// so CSS delimiters must be neutralized with CSS escapes to stop statement/block injection
// (`background:url(...)` payloads terminated by `;` or `}`). Order is load-bearing:
// backslash first (later passes emit new backslashes), then `;`/`}` — both BEFORE the `&`
// pass, whose entity output (`&amp;` etc.) contains semicolons that must not be re-encoded.
// `(`/`)`/`:` are deliberately NOT escaped: escaped characters decode back to DATA inside a
// token, so blanket-escaping them would block `url(`/`expression(` token formation only at
// the cost of breaking every legitimate function-shaped value (`calc(100% - 20px)`,
// `rgba(0,0,0,.5)`, `url(http://…)`), while `;`/`}` above already make new-declaration
// and block-breakout structurally impossible. Residual `url(javascript:)` payloads are
// inert in all maintained browsers (CSS url() never navigates); `expression()` is EOL IE.
const escapeStyle = (str: string): string => {
  const cssEscaped = str
    .replaceAll('\\', '\\5C ')
    .replaceAll(';', '\\3B ')
    .replaceAll('}', '\\7D ');
  const htmlEscaped = cssEscaped
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
  return htmlEscaped.replaceAll('"', '&quot;').replaceAll("'", '&#39;');
};

// WHY: UNQUOTED attribute values have no delimiter — whitespace or `=` inside the value
// terminates it and injects new attributes (`class={{ v }}` with `x onmouseover=...`).
// Entity encoding cannot express "no space" in this context, so the only sound encoder is
// percent-encoding of every delimiter (browsers percent-decode attribute values).
const escapeUnquotedAttribute = (str: string): string => {
  const percentEscaped = str.replaceAll('%', '%25').replaceAll('&', '%26').replaceAll('=', '%3D');
  const delimiterEscaped = percentEscaped
    .replaceAll('<', '%3C')
    .replaceAll('>', '%3E')
    .replaceAll('"', '%22')
    .replaceAll("'", '%27')
    .replaceAll('`', '%60');
  return delimiterEscaped
    .replaceAll(' ', '%20')
    .replaceAll('\t', '%09')
    .replaceAll('\n', '%0A')
    .replaceAll('\r', '%0D');
};

export { escapeAttribute, escapeHtml, escapeScriptString, escapeStyle, escapeUnquotedAttribute };
