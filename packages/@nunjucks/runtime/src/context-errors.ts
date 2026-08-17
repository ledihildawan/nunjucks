import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import { createLog } from '@nunjucks/error-formatter';
import type { NodeLocation } from '@nunjucks/shared';

interface BlockNotFoundInput {
  name: string;
  location: NodeLocation | undefined;
  lineno: number | null;
  colno: number | null;
}

/** Throws the catalog's `UNDEFINED_BLOCK` error, preferring explicit line data over the stored block location. */
const throwBlockNotFoundError = ({ name, location, lineno, colno }: BlockNotFoundInput): never => {
  throw createLog('error', {
    def: ERROR_DEFINITIONS.UNDEFINED_BLOCK,
    params: { name },
    subject: name,
    context: {
      lineno: lineno ?? location?.lineno ?? null,
      colno: colno ?? location?.colno ?? null,
      phase: 'render',
      lineBase: 'zero',
    },
  });
};

interface BlockNotFunctionInput {
  name: string;
}

/** Throws the catalog's `NOT_A_FUNCTION` error for a non-callable block registration. */
const throwBlockNotFunctionError = ({ name }: BlockNotFunctionInput): never => {
  throw createLog('error', {
    def: ERROR_DEFINITIONS.NOT_A_FUNCTION,
    params: { name },
    subject: name,
    context: { phase: 'render', lineBase: 'zero' },
  });
};

interface NoSuperBlockInput {
  name: string;
  lineno: number | null;
  colno: number | null;
}

/** Throws the catalog's `NO_SUPER_BLOCK` error for a missing or exhausted super chain. */
const throwNoSuperBlockError = ({ name, lineno, colno }: NoSuperBlockInput): never => {
  throw createLog('error', {
    def: ERROR_DEFINITIONS.NO_SUPER_BLOCK,
    params: { name },
    subject: name,
    context: { lineno, colno, phase: 'render', lineBase: 'zero' },
  });
};

export { throwBlockNotFoundError, throwBlockNotFunctionError, throwNoSuperBlockError };
