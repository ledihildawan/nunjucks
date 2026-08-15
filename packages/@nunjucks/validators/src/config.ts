import { err, isErr, ok, type Result } from '@nunjucks/lib';
import { type BaseValidationError, UNDEFINED_MODES } from '@nunjucks/shared';
import { flatMap, keys, pipe } from 'remeda';
import { isNonEmpty } from './is-non-empty.ts';
import { validateFilterName, validateGlobalName } from './reserved.ts';
import type { Environment } from './security/index.ts';

export interface ConfigValidationError extends BaseValidationError {
  code: string;
  subject: string;
  type: string;
}

export type ConfigValidationResult = Result<
  void,
  readonly [ConfigValidationError, ...ConfigValidationError[]]
>;

export interface Config {
  executionTimeout?: number;
  maxTemplateSize?: number;
  maxOutputSize?: number;
  streamingCoalesceBytes?: number;
  streamingIdleTimeout?: number;
  undefined?: string;
  sandboxMode?: string;
  sandboxEnvironment?: Environment;
  blockedContextKeys?: readonly unknown[];
  sandboxAllowlist?: readonly unknown[];
  allowedGlobals?: readonly unknown[];
  views?: unknown;
  // WHY: these are the USER-supplied names only (validated for reserved/dangerous). They are deliberately a
  // SEPARATE channel from the full merged filters/globals used at render time: the built-in defaults include
  // intentionally "dangerous-named" but safe-curated globals (Object/Array/Math via SAFE_BUILTINS), which would
  // false-positive if validated. The factory (core/src/factory.ts) maps its filters/globals into customFilters/
  // customGlobals so the user's names get checked without checking the trusted built-ins.
  customFilters?: Record<string, unknown>;
  customGlobals?: Record<string, unknown>;
  // WHY: user/plugin-supplied tests — same separate-channel rationale as customFilters; function-value
  // validation runs here because tests (like filters) are invoked by name at render time.
  customTests?: Record<string, unknown>;
}

const VALID_ENVIRONMENTS: ReadonlySet<Environment> = new Set(['auto', 'node', 'browser', 'deno']);
const VALID_SANDBOX_MODES: ReadonlySet<string> = new Set(['blocklist', 'allowlist']);
const VALID_UNDEFINED_MODES: ReadonlySet<string> = new Set(UNDEFINED_MODES);

const validateNonNegativeNumeric = (
  value: number | undefined,
  subject: string
): ConfigValidationError[] =>
  value !== undefined && (!Number.isFinite(value) || value < 0)
    ? [
        {
          code: 'INVALID_CONFIG',
          message: `Invalid configuration: ${subject} must be >= 0`,
          subject,
          type: 'numeric',
        },
      ]
    : [];

const validateNumericConfig = (config: Config): ConfigValidationError[] => [
  ...validateNonNegativeNumeric(config.executionTimeout, 'executionTimeout'),
  ...validateNonNegativeNumeric(config.maxTemplateSize, 'maxTemplateSize'),
  ...validateNonNegativeNumeric(config.maxOutputSize, 'maxOutputSize'),
  ...validateNonNegativeNumeric(config.streamingCoalesceBytes, 'coalesceBytes'),
  ...validateNonNegativeNumeric(config.streamingIdleTimeout, 'idleTimeout'),
];

interface EnumMembershipInput {
  value: string | undefined;
  validValues: ReadonlySet<string>;
  subject: string;
  type: string;
}

const validateEnumMembership = ({
  value,
  validValues,
  subject,
  type,
}: EnumMembershipInput): ConfigValidationError[] =>
  value !== undefined && !validValues.has(value)
    ? [
        {
          code: 'INVALID_CONFIG',
          message: `Invalid configuration: ${subject} must be one of ${[...validValues].join(', ')}`,
          subject,
          type,
        },
      ]
    : [];

const validateEnumConfig = (config: Config): ConfigValidationError[] => [
  ...validateEnumMembership({
    value: config.undefined,
    validValues: VALID_UNDEFINED_MODES,
    subject: 'undefined',
    type: 'enum',
  }),
  ...validateEnumMembership({
    value: config.sandboxMode,
    validValues: VALID_SANDBOX_MODES,
    subject: 'sandboxMode',
    type: 'sandbox',
  }),
  ...validateEnumMembership({
    value: config.sandboxEnvironment,
    validValues: VALID_ENVIRONMENTS,
    subject: 'sandboxEnvironment',
    type: 'sandbox',
  }),
];

interface StringArrayInput {
  value: readonly unknown[] | undefined;
  subject: string;
  type: string;
}

const validateStringArray = ({ value, subject, type }: StringArrayInput): ConfigValidationError[] =>
  value !== undefined && !value.every((entry) => typeof entry === 'string')
    ? [
        {
          code: 'INVALID_CONFIG',
          message: `Invalid configuration: ${subject} must be an array of strings`,
          subject,
          type,
        },
      ]
    : [];

const validateViews = (views: unknown): ConfigValidationError[] =>
  views !== undefined && views !== null && typeof views !== 'string'
    ? [
        {
          code: 'INVALID_CONFIG',
          message: 'Invalid configuration: views must be a string path',
          subject: 'views',
          type: 'path',
        },
      ]
    : [];

const validateCallableValues = (
  values: Record<string, unknown> | undefined,
  subject: string
): ConfigValidationError[] => {
  if (!values) {
    return [];
  }
  return pipe(
    keys(values),
    flatMap((name) =>
      typeof values[name] !== 'function'
        ? [
            {
              code: 'INVALID_CONFIG',
              message: `Invalid configuration: ${subject}.${name} must be a function`,
              subject: `${subject}.${name}`,
              type: 'callable',
            },
          ]
        : []
    )
  );
};

const validateCustomFilters = (config: Config): ConfigValidationError[] => {
  if (!config.customFilters) {
    return [];
  }
  return pipe(
    keys(config.customFilters),
    flatMap((name) => {
      const validation = validateFilterName(name);
      if (isErr(validation)) {
        const { code, message, subject, type } = validation.error;
        return [{ code, message, subject, type }];
      }
      return [];
    })
  );
};

const validateCustomGlobals = (config: Config): ConfigValidationError[] => {
  if (!config.customGlobals) {
    return [];
  }
  return pipe(
    keys(config.customGlobals),
    flatMap((name) => {
      const validation = validateGlobalName(name);
      if (isErr(validation)) {
        const { code, message, subject, type } = validation.error;
        return [{ code, message, subject, type }];
      }
      return [];
    })
  );
};

export const validateConfig = (config: Config): ConfigValidationResult => {
  const errors = [
    ...validateNumericConfig(config),
    ...validateEnumConfig(config),
    ...validateStringArray({ value: config.blockedContextKeys, subject: 'blockedContextKeys', type: 'security' }),
    ...validateStringArray({ value: config.sandboxAllowlist, subject: 'sandboxAllowlist', type: 'security' }),
    ...validateStringArray({ value: config.allowedGlobals, subject: 'allowedGlobals', type: 'security' }),
    ...validateViews(config.views),
    ...validateCallableValues(config.customFilters, 'filters'),
    ...validateCallableValues(config.customTests, 'tests'),
    ...validateCustomFilters(config),
    ...validateCustomGlobals(config),
  ];

  if (!isNonEmpty(errors)) {
    return ok(undefined);
  }
  const [first, ...rest] = errors;
  return err([first, ...rest] as const);
};
