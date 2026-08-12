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

export { escapeHtml, escapeAttribute, escapeScriptString, escapeStyle };