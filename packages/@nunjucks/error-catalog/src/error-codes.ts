import type { ERROR_DEFINITIONS } from './errors/index.ts';

// WHY: code names referenced by cross-package runtime logic (fatal-stream
// classification, timeout error factories) must derive from the catalog so
// renaming a definition breaks the build instead of silently drifting.
const catalogCode = <T extends keyof typeof ERROR_DEFINITIONS>(name: T): T => name;

const ERROR_CODES = {
  CIRCULAR_INCLUDE: catalogCode('CIRCULAR_INCLUDE'),
  INVALID_ASSIGN_TARGET: catalogCode('INVALID_ASSIGN_TARGET'),
  SANDBOX_CODE_EXECUTION: catalogCode('SANDBOX_CODE_EXECUTION'),
  STREAM_ALREADY_CONSUMED: catalogCode('STREAM_ALREADY_CONSUMED'),
  TIMEOUT: catalogCode('TIMEOUT'),
} as const;

export { ERROR_CODES };
