// WHY: single source for JS builtin constructor names — reserved.ts blocks them as
// template identifiers while security/context-security.ts allowlists them in strict
// scans; both derive from this list so the two surfaces cannot drift.
const JS_BUILTIN_CONSTRUCTORS: readonly string[] = [
  'Array',
  'Object',
  'String',
  'Number',
  'Boolean',
  'Date',
  'RegExp',
  'Math',
  'JSON',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'Promise',
  'Symbol',
  'Error',
  'TypeError',
  'RangeError',
  'SyntaxError',
];

export { JS_BUILTIN_CONSTRUCTORS };
