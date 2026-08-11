import { OBJECT_INTRINSICS, CODE_EXECUTION_KEYS } from '@nunjucks/shared';

export const ExpressionSecurityError = {
  DYNAMIC_PROPERTY_ACCESS: 'DYNAMIC_PROPERTY_ACCESS',
  DANGEROUS_BRACKET_ACCESS: 'DANGEROUS_BRACKET_ACCESS',
  UNSAFE_PROPERTY: 'UNSAFE_PROPERTY',
} as const;

export const DEFAULT_SECURITY_CONFIG = {
  allowDynamicPropertyAccess: false,
  allowConstructorAccess: false,
  allowPrototypeAccess: false,
  blockedPropertyPatterns: [
    /^__/,
    /constructor$/,
    /prototype$/,
  ],
} as const;

export type ExpressionSecurityConfig = {
  allowDynamicPropertyAccess?: boolean;
  allowConstructorAccess?: boolean;
  allowPrototypeAccess?: boolean;
  blockedPropertyPatterns?: readonly RegExp[];
};

export const DANGEROUS_PROPERTIES: ReadonlySet<string> = new Set(OBJECT_INTRINSICS);

export const DANGEROUS_CALLEES: ReadonlySet<string> = new Set(CODE_EXECUTION_KEYS);
