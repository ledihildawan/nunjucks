import { expect, test } from 'bun:test';
import { RESERVED_KEYWORDS } from '@nunjucks/validators';
import { STATEMENT_PARSERS } from './registry.ts';

// WHY: validators cannot import the parser (DAG edge is parser -> validators), so this
// adjacent test pins the SSOT — every statement tag must be a reserved keyword, keeping
// the hand-maintained list in validators/reserved.ts from drifting behind the registry.
test('every statement parser tag is a reserved keyword', () => {
  const unreservedTags = Object.keys(STATEMENT_PARSERS).filter(
    (tag) => !RESERVED_KEYWORDS.has(tag)
  );
  expect(unreservedTags).toEqual([]);
});
