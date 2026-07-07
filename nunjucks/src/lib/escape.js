const escapeMap = {
  '&': '&amp;',
  '"': '&quot;',
  '\'': '&#39;',
  '<': '&lt;',
  '>': '&gt;',
  '\\': '&#92;',
};

const escapeRegex = /[&"'<>\\]/g;

export function lookupEscape(ch) {
  return escapeMap[ch];
}

export function escape(val) {
  return val.replace(escapeRegex, lookupEscape);
}
