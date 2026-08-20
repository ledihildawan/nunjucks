import { ERROR_CODES } from '@nunjucks/error-catalog';
import { err, isErr, ok, type Result } from '@nunjucks/lib';
import type { Environment } from '@nunjucks/shared';
import {
  type BaseValidationError,
  CONTENT_TYPES,
  ENVIRONMENT_VALUES,
  SANDBOX_MODES,
  UNDEFINED_MODES,
} from '@nunjucks/shared';
import { flatMap, keys, pipe } from 'remeda';
import { isNonEmpty } from './is-non-empty.ts';
import { validateFilterName, validateGlobalName } from './reserved.ts';

interface ConfigValidationError extends BaseValidationError {
  code: string;
  subject: string;
  type: string;
}

type ConfigValidationResult = Result<
  void,
  readonly [ConfigValidationError, ...ConfigValidationError[]]
>;

interface Config {
  executionTimeout?: number;
  maxTemplateSize?: number;
  maxOutputSize?: number;
  streamingCoalesceBytes?: number;
  cacheMaxEntries?: number;
  streamingIdleTimeout?: number;
  undefined?: string;
  sandboxMode?: string;
  sandboxEnvironment?: Environment;
  streamContentType?: string;
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

const VALID_ENVIRONMENTS: ReadonlySet<Environment> = new Set(ENVIRONMENT_VALUES);
const VALID_SANDBOX_MODES: ReadonlySet<string> = new Set(SANDBOX_MODES);
const VALID_UNDEFINED_MODES: ReadonlySet<string> = new Set(UNDEFINED_MODES);
const VALID_CONTENT_TYPES: ReadonlySet<string> = new Set(CONTENT_TYPES);

const validateNonNegativeNumeric = (
  value: number | undefined,
  subject: string
): ConfigValidationError[] =>
  value !== undefined && (!Number.isFinite(value) || value < 0)
    ? [
        {
          code: ERROR_CODES.INVALID_CONFIG,
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
  ...validateNonNegativeNumeric(config.cacheMaxEntries, 'cacheMaxEntries'),
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
          code: ERROR_CODES.INVALID_CONFIG,
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
  ...validateEnumMembership({
    value: config.streamContentType,
    validValues: VALID_CONTENT_TYPES,
    subject: 'streamContentType',
    type: 'enum',
  }),
];

interface StringArrayInput {
  value: readonly unknown[] | undefined;
  subject: string;
  type: string;
}

const validateStringArray = ({
  value,
  subject,
  type,
}: StringArrayInput): ConfigValidationError[] =>
  // WHY: null is tolerated as "unset" — the flat options bag preserves null for keys
  // like blockedContextKeys (see factory compact()), and a JS caller passing null must
  // get the catalogued INVALID_CONFIG error, not a TypeError from value.every.
  value !== undefined && value !== null && !value.every((entry) => typeof entry === 'string')
    ? [
        {
          code: ERROR_CODES.INVALID_CONFIG,
          message: `Invalid configuration: ${subject} must be an array of strings`,
          subject,
          type,
        },
      ]
    : [];

const isValidViewsValue = (views: unknown): boolean =>
  typeof views === 'string' ||
  (Array.isArray(views) && views.every((entry) => typeof entry === 'string'));

const validateViews = (views: unknown): ConfigValidationError[] =>
  views !== undefined && views !== null && !isValidViewsValue(views)
    ? [
        {
          code: ERROR_CODES.INVALID_CONFIG,
          message: 'Invalid configuration: views must be a string path or an array of string paths',
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
              code: ERROR_CODES.INVALID_CONFIG,
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

/**
 * Validates engine configuration at factory creation, rejecting invalid values
 * (NaN/negative numerics, bad enums, non-string arrays, non-callable or
 * reserved-named customs) as an `Err` tuple instead of crashing at render time.
 * Collects violations from every category before failing — no short-circuit.
 */
export const validateConfig = (config: Config): ConfigValidationResult => {
  const errors = [
    ...validateNumericConfig(config),
    ...validateEnumConfig(config),
    ...validateStringArray({
      value: config.blockedContextKeys,
      subject: 'blockedContextKeys',
      type: 'security',
    }),
    ...validateStringArray({
      value: config.sandboxAllowlist,
      subject: 'sandboxAllowlist',
      type: 'security',
    }),
    ...validateStringArray({
      value: config.allowedGlobals,
      subject: 'allowedGlobals',
      type: 'security',
    }),
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
