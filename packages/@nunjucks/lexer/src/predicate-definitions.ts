type TestCategory =
  | 'existence'
  | 'boolean'
  | 'primitive'
  | 'collection'
  | 'objectType'
  | 'numeric'
  | 'string'
  | 'equality'
  | 'property'
  | 'html';

interface TestDefinition {
  name: string;
  category: TestCategory;
  args: 0 | 1 | 2;
  description: string;
}

const TEST_TESTS: readonly TestDefinition[] = [
  { name: 'defined', category: 'existence', args: 0, description: 'Value is not undefined' },
  { name: 'undefined', category: 'existence', args: 0, description: 'Value is undefined' },
  { name: 'null', category: 'existence', args: 0, description: 'Value is null' },
  { name: 'none', category: 'existence', args: 0, description: 'Value is null or undefined' },
  { name: 'truthy', category: 'existence', args: 0, description: 'Value is truthy' },
  { name: 'falsy', category: 'existence', args: 0, description: 'Value is falsy' },

  { name: 'true', category: 'boolean', args: 0, description: 'Value is strictly true' },
  { name: 'false', category: 'boolean', args: 0, description: 'Value is strictly false' },
  { name: 'boolean', category: 'boolean', args: 0, description: 'Value is a boolean' },

  { name: 'string', category: 'primitive', args: 0, description: 'Value is a string' },
  { name: 'number', category: 'primitive', args: 0, description: 'Value is a number' },
  { name: 'integer', category: 'primitive', args: 0, description: 'Value is an integer' },
  {
    name: 'float',
    category: 'primitive',
    args: 0,
    description: 'Value is a float (non-integer number)',
  },
  { name: 'bigint', category: 'primitive', args: 0, description: 'Value is a bigint' },
  { name: 'symbol', category: 'primitive', args: 0, description: 'Value is a symbol' },

  { name: 'array', category: 'collection', args: 0, description: 'Value is an array' },
  {
    name: 'object',
    category: 'collection',
    args: 0,
    description: 'Value is an object (not null, typeof object)',
  },
  { name: 'Map', category: 'collection', args: 0, description: 'Value is a Map' },
  { name: 'Set', category: 'collection', args: 0, description: 'Value is a Set' },
  { name: 'iterable', category: 'collection', args: 0, description: 'Value has a Symbol.iterator' },
  {
    name: 'asynciterable',
    category: 'collection',
    args: 0,
    description: 'Value has a Symbol.asyncIterator',
  },
  { name: 'typedarray', category: 'collection', args: 0, description: 'Value is a TypedArray' },
  { name: 'buffer', category: 'collection', args: 0, description: 'Value is a Buffer (Node/Bun)' },

  { name: 'function', category: 'objectType', args: 0, description: 'Value is a function' },
  {
    name: 'asyncfunction',
    category: 'objectType',
    args: 0,
    description: 'Value is an async function',
  },
  { name: 'Date', category: 'objectType', args: 0, description: 'Value is a Date' },
  { name: 'RegExp', category: 'objectType', args: 0, description: 'Value is a RegExp' },
  { name: 'Error', category: 'objectType', args: 0, description: 'Value is an Error' },
  { name: 'URL', category: 'objectType', args: 0, description: 'Value is a URL' },
  { name: 'Promise', category: 'objectType', args: 0, description: 'Value is a Promise' },

  { name: 'odd', category: 'numeric', args: 0, description: 'Value is an odd number' },
  { name: 'even', category: 'numeric', args: 0, description: 'Value is an even number' },
  { name: 'positive', category: 'numeric', args: 0, description: 'Value is positive (> 0)' },
  { name: 'negative', category: 'numeric', args: 0, description: 'Value is negative (< 0)' },
  { name: 'zero', category: 'numeric', args: 0, description: 'Value is zero' },
  { name: 'finite', category: 'numeric', args: 0, description: 'Value is a finite number' },
  { name: 'nan', category: 'numeric', args: 0, description: 'Value is NaN' },
  { name: 'divisibleby', category: 'numeric', args: 1, description: 'Value is divisible by n' },
  {
    name: 'between',
    category: 'numeric',
    args: 2,
    description: 'Value is between min and max (inclusive)',
  },

  { name: 'empty', category: 'string', args: 0, description: 'Value is empty string' },
  {
    name: 'blank',
    category: 'string',
    args: 0,
    description: 'Value is blank (empty or whitespace only)',
  },
  { name: 'lower', category: 'string', args: 0, description: 'Value is all lowercase' },
  { name: 'upper', category: 'string', args: 0, description: 'Value is all uppercase' },
  {
    name: 'alpha',
    category: 'string',
    args: 0,
    description: 'Value contains only alphabetic characters',
  },
  {
    name: 'alphanumeric',
    category: 'string',
    args: 0,
    description: 'Value contains only alphanumeric characters',
  },
  {
    name: 'numeric',
    category: 'string',
    args: 0,
    description: 'Value contains only numeric characters',
  },
  {
    name: 'startswith',
    category: 'string',
    args: 1,
    description: 'Value starts with the given string',
  },
  {
    name: 'endswith',
    category: 'string',
    args: 1,
    description: 'Value ends with the given string',
  },
  {
    name: 'contains',
    category: 'string',
    args: 1,
    description: 'Value contains the given string/element',
  },
  {
    name: 'matches',
    category: 'string',
    args: 1,
    description: 'Value matches the given regex pattern',
  },

  { name: 'sameas', category: 'equality', args: 1, description: 'Value is strictly same as (===)' },
  {
    name: 'equalto',
    category: 'equality',
    args: 1,
    description: 'Value is equal to (deep equality)',
  },

  {
    name: 'has',
    category: 'property',
    args: 1,
    description: 'Object has the key (using in operator)',
  },
  {
    name: 'hasown',
    category: 'property',
    args: 1,
    description: 'Object has own property (Object.hasOwn)',
  },

  { name: 'safe', category: 'html', args: 0, description: 'Value is a SafeString' },
  { name: 'escaped', category: 'html', args: 0, description: 'Value is not a SafeString' },
] as const;

const TEST_KEYWORDS: ReadonlySet<string> = new Set(TEST_TESTS.map((t) => t.name));

export const isTestKeyword = (name: string): boolean => TEST_KEYWORDS.has(name);
