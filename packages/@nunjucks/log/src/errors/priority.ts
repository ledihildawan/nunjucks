const ERROR_PRIORITY = {
  NULL_VALUE: 1,
  UNDEFINED_PROPERTY: 2,
  UNDEFINED_VARIABLE: 3,
  NOT_CALLABLE: 4,
  UNDEFINED_FILTER: 5,
  UNDEFINED_FUNCTION: 6,
  KEY_NOT_FOUND: 7,
  UNDEFINED_TEST: 8,
  UNDEFINED_BLOCK: 9,
} as const;

type ErrorPriority = typeof ERROR_PRIORITY[keyof typeof ERROR_PRIORITY];

interface ErrorCandidate {
  readonly type: string;
  readonly priority: number;
}

function getMostHonestError(errors: readonly ErrorCandidate[]): ErrorCandidate | null {
  if (!errors || errors.length === 0) { return null; }
  return errors.toSorted((a, b) => a.priority - b.priority)[0] ?? null;
}

/** Sorts after every known priority, so unclassified errors rank last. */
const UNKNOWN_ERROR_PRIORITY = 999;

function getPriority(type: string): number {
  return ERROR_PRIORITY[type as keyof typeof ERROR_PRIORITY] ?? UNKNOWN_ERROR_PRIORITY;
}

export { ERROR_PRIORITY, getMostHonestError, getPriority };
export type { ErrorPriority, ErrorCandidate };
