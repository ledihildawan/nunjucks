export const ERROR_PRIORITY = {
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

export type ErrorPriority = typeof ERROR_PRIORITY[keyof typeof ERROR_PRIORITY];

export interface ErrorCandidate {
  readonly type: string;
  readonly priority: number;
}

export function getMostHonestError(errors: readonly ErrorCandidate[]): ErrorCandidate | null {
  if (!errors || errors.length === 0) return null;
  return errors.toSorted((a, b) => a.priority - b.priority)[0] ?? null;
}

export function getPriority(type: string): number {
  return ERROR_PRIORITY[type as keyof typeof ERROR_PRIORITY] ?? 999;
}
