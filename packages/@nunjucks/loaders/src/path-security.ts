// WHY: pure string math on purpose — containment is achievable with segment
// comparison alone (node:path adds nothing here). Inputs arrive realpath-resolved
// from the loader, so only canonical absolute paths must hold. Colocated with its
// sole consumer (the fs loader) rather than @nunjucks/lib, keeping the lib barrel
// free of loader-domain policy.

// WHY: a NUL byte in a file name is a cheap first line of defense against path-traversal attempts that smuggle null terminators (e.g. "..\0/") past length-based checks.
const containsNullByte = (name: string): boolean => name.includes('\0');

const splitPathSegments = (value: string): readonly string[] =>
  value.split(/[\\/]+/).filter((segment) => segment.length > 0);

const isAbsolutePath = (value: string): boolean =>
  value.startsWith('/') || value.startsWith('\\') || /^[A-Za-z]:[\\/]/u.test(value);

// WHY: win32 drive roots and UNC hosts compare case-insensitively (matching
// node:path semantics); POSIX path segments stay case-sensitive.
const looksLikeWin32Path = (value: string): boolean =>
  /^[A-Za-z]:[\\/]/u.test(value) || value.includes('\\');

/**
 * Checks whether `fullPath` resolves inside `basePath`: containment holds when
 * both are absolute, share the same root, and every base segment matches in
 * order. Compared segment-wise (never by string prefix) so sibling directories
 * sharing a prefix (`/var/www` vs `/var/www2`) cannot pass; non-canonical or
 * non-absolute inputs fail closed.
 */
const isWithinBase = (basePath: string, fullPath: string): boolean => {
  if (!isAbsolutePath(basePath) || !isAbsolutePath(fullPath)) {
    return false;
  }
  const base = splitPathSegments(basePath);
  const full = splitPathSegments(fullPath);
  if (base.length === 0 || full.length < base.length) {
    return false;
  }
  // WHY: a `..` segment cannot appear in realpath output — its presence means the
  // input is not canonical, so containment is refused rather than resolved.
  if (full.includes('..') || base.includes('..')) {
    return false;
  }
  const ignoreCase = looksLikeWin32Path(basePath) || looksLikeWin32Path(fullPath);
  const segmentEquals = ignoreCase
    ? (left: string, right: string) => left.toLowerCase() === right.toLowerCase()
    : (left: string, right: string) => left === right;
  // WHY: `full[index] ?? ''` is safe — length was checked, and a filtered segment is
  // never empty, so the fallback can never equal a real base segment.
  return base.every((segment, index) => segmentEquals(segment, full[index] ?? ''));
};

export { containsNullByte, isWithinBase };
