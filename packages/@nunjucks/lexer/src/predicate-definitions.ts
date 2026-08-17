import { BUILTIN_TEST_NAMES } from '@nunjucks/shared';

// WHY: SSOT consumption — the keyword set for `x is <name>` tokenization comes from
// shared's BUILTIN_TEST_NAMES, drift-pinned against the runtime's BUILTIN_TESTS
// registry (builtin-predicates.test.ts). The per-test category/args/description
// metadata this file previously carried had zero consumers and was purged.
const TEST_KEYWORDS: ReadonlySet<string> = new Set(BUILTIN_TEST_NAMES);

export const isTestKeyword = (name: string): boolean => TEST_KEYWORDS.has(name);
