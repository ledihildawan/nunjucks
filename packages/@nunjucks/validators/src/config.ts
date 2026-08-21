import { ERROR_CODES } from '@nunjucks/error-catalog';
import { err, isErr, isObject, ok, type Result } from '@nunjucks/lib';
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
import { isParserExtensionShape } from './parser-extension.ts';
import { type ReservedNameError, validateFilterName, validateGlobalName } from './reserved.ts';

interface ConfigValidationError extends BaseValidationError {
  code: string;
  subject: string;
  type: string;
}

type ConfigValidationResult = Result<
  void,
  readonly [ConfigValidationError, ...ConfigValidationError[]]
>;

const VALID_ENVIRONMENTS: ReadonlySet<Environment> = new Set(ENVIRONMENT_VALUES);
const VALID_SANDBOX_MODES: ReadonlySet<string> = new Set(SANDBOX_MODES);
const VALID_UNDEFINED_MODES: ReadonlySet<string> = new Set(UNDEFINED_MODES);
const VALID_CONTENT_TYPES: ReadonlySet<string> = new Set(CONTENT_TYPES);

// WHY: null is tolerated as "unset" across ALL field kinds — the flat options bag
// preserves null for keys a JS caller left empty (see factory compact()), so numerics
// follow the same rule as string arrays: null parses as unset, while non-number values
// (strings, NaN, Infinity) and negatives stay INVALID_CONFIG errors — the boundary is
// `unknown`, so the typeof guard fails closed on anything the caller smuggled in.
const validateNonNegativeNumeric = (value: unknown, subject: string): ConfigValidationError[] =>
  value === undefined || value === null
    ? []
    : typeof value !== 'number' || !Number.isFinite(value) || value < 0
      ? [
          {
            code: ERROR_CODES.INVALID_CONFIG,
            message: `Invalid configuration: ${subject} must be >= 0`,
            subject,
            type: 'numeric',
          },
        ]
      : [];

const validateNumericConfig = (config: Record<string, unknown>): ConfigValidationError[] => [
  ...validateNonNegativeNumeric(config.executionTimeout, 'executionTimeout'),
  ...validateNonNegativeNumeric(config.maxTemplateSize, 'maxTemplateSize'),
  ...validateNonNegativeNumeric(config.maxOutputSize, 'maxOutputSize'),
  ...validateNonNegativeNumeric(config.cacheMaxEntries, 'cacheMaxEntries'),
  ...validateNonNegativeNumeric(config.streamingCoalesceBytes, 'coalesceBytes'),
  ...validateNonNegativeNumeric(config.streamingIdleTimeout, 'idleTimeout'),
];

interface EnumMembershipInput {
  value: unknown;
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
  value === undefined
    ? []
    : typeof value !== 'string' || !validValues.has(value)
      ? [
          {
            code: ERROR_CODES.INVALID_CONFIG,
            message: `Invalid configuration: ${subject} must be one of ${[...validValues].join(', ')}`,
            subject,
            type,
          },
        ]
      : [];

const validateEnumConfig = (config: Record<string, unknown>): ConfigValidationError[] => [
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
  value: unknown;
  subject: string;
  type: string;
}

const validateStringArray = ({
  value,
  subject,
  type,
}: StringArrayInput): ConfigValidationError[] =>
  // WHY: null is tolerated as "unset" — the unified rule shared with the numeric
  // validators: the flat options bag preserves null for keys like blockedContextKeys
  // (see factory compact()), and a JS caller passing null must get the catalogued
  // INVALID_CONFIG error, not a TypeError from value.every. The boundary is `unknown`,
  // so non-array garbage narrows to the same catalogued error instead of crashing.
  value !== undefined &&
  value !== null &&
  !(Array.isArray(value) && value.every((entry) => typeof entry === 'string'))
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

const validateCallableValues = (values: unknown, subject: string): ConfigValidationError[] => {
  if (!isObject(values)) {
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

// WHY: extensions previously degraded silently — a malformed entry was dropped at
// compile time and surfaced only later as a parse-time "unknown block tag" error.
// The boundary now fails closed: each map entry must satisfy the SSOT shape guard
// (isParserExtensionShape) so misconfigured extensions are rejected where they enter.
const validateExtensions = (extensions: unknown): ConfigValidationError[] => {
  if (extensions === undefined || extensions === null) {
    return [];
  }
  if (!isObject(extensions)) {
    return [
      {
        code: ERROR_CODES.INVALID_CONFIG,
        message: 'Invalid configuration: extensions must be a map of name → extension object',
        subject: 'extensions',
        type: 'extensions',
      },
    ];
  }
  return pipe(
    keys(extensions),
    flatMap((name) =>
      isParserExtensionShape(extensions[name])
        ? []
        : [
            {
              code: ERROR_CODES.INVALID_CONFIG,
              message: `Invalid configuration: extensions.${name} must provide tags (string[]) and a parse function`,
              subject: `extensions.${name}`,
              type: 'extensions',
            },
          ]
    )
  );
};

// WHY: custom filters and globals run the exact same name-validation pipeline —
// only the reserved-word flavor differs, so one parameterized helper serves both
// and the error codes/messages stay identical by construction.
const validateCustomNames = (
  values: unknown,
  validateName: (name: string) => Result<void, ReservedNameError>
): ConfigValidationError[] => {
  if (!isObject(values)) {
    return [];
  }
  return pipe(
    keys(values),
    flatMap((name) => {
      const validation = validateName(name);
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
 * The parameter is `unknown` — validateConfig sits on the untyped caller
 * boundary — and every field is narrowed by the runtime guards above.
 * Collects violations from every category before failing — no short-circuit.
 */
export const validateConfig = (config: unknown): ConfigValidationResult => {
  // WHY: customFilters/customGlobals/customTests are the USER-supplied names only
  // (validated for reserved/dangerous). They are deliberately a SEPARATE channel from
  // the full merged filters/globals used at render time: the built-in defaults include
  // intentionally "dangerous-named" but safe-curated globals (Object/Array/Math via
  // SAFE_BUILTINS), which would false-positive if validated. The factory
  // (core/src/factory.ts) maps its filters/globals into customFilters/customGlobals so
  // the user's names get checked without checking the trusted built-ins. Tests are
  // user/plugin-supplied — same separate-channel rationale; function-value validation
  // runs here because tests (like filters) are invoked by name at render time.
  const configRecord: Record<string, unknown> = isObject(config) ? config : {};
  const errors = [
    ...validateNumericConfig(configRecord),
    ...validateEnumConfig(configRecord),
    ...validateStringArray({
      value: configRecord.blockedContextKeys,
      subject: 'blockedContextKeys',
      type: 'security',
    }),
    ...validateStringArray({
      value: configRecord.sandboxAllowlist,
      subject: 'sandboxAllowlist',
      type: 'security',
    }),
    ...validateStringArray({
      value: configRecord.allowedGlobals,
      subject: 'allowedGlobals',
      type: 'security',
    }),
    ...validateViews(configRecord.views),
    ...validateCallableValues(configRecord.customFilters, 'filters'),
    ...validateCallableValues(configRecord.customTests, 'tests'),
    ...validateCustomNames(configRecord.customFilters, validateFilterName),
    ...validateCustomNames(configRecord.customGlobals, validateGlobalName),
    ...validateExtensions(configRecord.extensions),
  ];

  if (!isNonEmpty(errors)) {
    return ok(undefined);
  }
  const [first, ...rest] = errors;
  return err([first, ...rest] as const);
};
