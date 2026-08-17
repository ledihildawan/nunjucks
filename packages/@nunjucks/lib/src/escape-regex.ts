/** Escapes all regex metacharacters in `value` so the result matches literally. */
const escapeRegex = (value: string): string => value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');

export { escapeRegex };
