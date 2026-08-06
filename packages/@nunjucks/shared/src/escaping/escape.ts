export const escapeHtml = (str: string): string => str
  .replace(/&/gu, '&amp;')
  .replace(/</gu, '&lt;')
  .replace(/>/gu, '&gt;')
  .replace(/"/gu, '&quot;')
  .replace(/'/gu, '&#39;')
  .replace(/\\/gu, '&#92;');
