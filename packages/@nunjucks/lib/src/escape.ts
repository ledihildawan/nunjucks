const escapeHtml = (str: string): string => str
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll('\'', '&#39;')
  .replaceAll('\\', '&#92;');

const escapeAttribute = (str: string): string => str
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll('\'', '&#39;')
  .replaceAll('`', '&#96;');

const escapeScriptString = (str: string): string => str
  .replaceAll('\\', '\\\\')
  .replaceAll('"', '\\"')
  .replaceAll('\'', "\\'")
  .replaceAll('\n', '\\n')
  .replaceAll('\r', '\\r')
  .replaceAll('\t', '\\t')
  .replaceAll('<', '\\u003c')
  .replaceAll('>', '\\u003e');

const escapeStyle = (str: string): string => str
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll('\'', '&#39;');

// WHY: UNQUOTED attribute values have no delimiter — whitespace or `=` inside the value
// terminates it and injects new attributes (`class={{ v }}` with `x onmouseover=...`).
// Entity encoding cannot express "no space" in this context, so the only sound encoder is
// percent-encoding of every delimiter (browsers percent-decode attribute values).
const escapeUnquotedAttribute = (str: string): string => str
  .replaceAll('%', '%25')
  .replaceAll('&', '%26')
  .replaceAll('=', '%3D')
  .replaceAll('<', '%3C')
  .replaceAll('>', '%3E')
  .replaceAll('"', '%22')
  .replaceAll('\'', '%27')
  .replaceAll('`', '%60')
  .replaceAll(' ', '%20')
  .replaceAll('\t', '%09')
  .replaceAll('\n', '%0A')
  .replaceAll('\r', '%0D');

export { escapeHtml, escapeAttribute, escapeScriptString, escapeStyle, escapeUnquotedAttribute };