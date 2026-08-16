import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import type {
  ErrorDefinitionEntry,
  TemplateError,
  TemplateWarning,
} from '@nunjucks/error-formatter';
import { createLog } from '@nunjucks/error-formatter';
import { getBlockedKeyCategory } from '@nunjucks/shared';
import type { ResolvedSandboxOptions } from './sandbox-options.ts';
import { isAllowedKey } from './sandbox-predicates.ts';

type DynamicCallable = (...args: unknown[]) => unknown;

interface SandboxErrorInput {
  errorDef: ErrorDefinitionEntry;
  key: string | symbol;
  sandboxOptions: ResolvedSandboxOptions;
}

// WHY: sandbox errors are thrown from Proxy traps where throw is the sole failure channel; the error shape is enriched with the blocked key's category for diagnostics.
const sandboxError = ({
  errorDef,
  key,
  sandboxOptions,
}: SandboxErrorInput): TemplateError | TemplateWarning => {
  const env = sandboxOptions.environment ?? 'auto';
  const category = getBlockedKeyCategory(String(key), env);
  return createLog('error', {
    def: errorDef,
    params: { key: String(key), category: category ?? '', environment: env },
    subject: String(key),
    context: { phase: 'render', lineBase: 'zero' },
  });
};

const blockedKeysError = (
  key: string,
  blockedKeys: readonly string[]
): TemplateError | TemplateWarning => {
  const created = createLog('error', {
    def: ERROR_DEFINITIONS.BLOCKED_CONTEXT_KEYS,
    params: { keys: blockedKeys.join(', ') },
    subject: key,
    context: { phase: 'render', lineBase: 'zero' },
  });
  Object.assign(created, { blockedKeys });
  return created;
};

const assertAllowed = (key: string, sandboxOptions: ResolvedSandboxOptions): void => {
  // WHY: invoked from Proxy get/set traps where throw is the sole failure channel — Result is not expressible in a trap return.
  if (!(sandboxOptions.blocklistMode || isAllowedKey(key, sandboxOptions.allowlist))) {
    throw sandboxError({ errorDef: ERROR_DEFINITIONS.SANDBOX_ALLOWLIST, key, sandboxOptions });
  }
};

export type { DynamicCallable };
export { assertAllowed, blockedKeysError, sandboxError };
