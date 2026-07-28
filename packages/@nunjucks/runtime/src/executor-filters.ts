import { createLog } from '@nunjucks/log';
import { getError } from '@nunjucks/log';
import { detectUndefinedInput, type UndefinedInputResult } from './executor-undefined.ts';

type FilterFunction = (...args: unknown[]) => unknown;

interface GetFilterConfig {
  env?: { getFilter: (name: string, lineno: number | null, colno: number | null) => unknown };
}

const lookupFilter = (
  name: string,
  filters: Record<string, FilterFunction>,
  context: Record<string, unknown>,
  config: GetFilterConfig
): FilterFunction | undefined => {
  const filterFn = filters[name];
  if (filterFn) { return filterFn; }

  let ctxFn: FilterFunction | null = null;
  if (context[name] && typeof context[name] === 'function') {
    ctxFn = context[name] as FilterFunction;
  }
  if (ctxFn) { return ctxFn; }

  if (config.env?.getFilter) {
    const envFilter = config.env.getFilter(name, null, null);
    if (envFilter) { return envFilter as FilterFunction; }
  }

  return undefined;
};

const getErrorLocation = (
  inputLineno: number | undefined,
  inputColno: number | undefined,
  filterLineno: number | null,
  filterColno: number | null
): { lineno: number | null; colno: number | null } => {
  const useInputLocation = inputLineno !== undefined && inputColno !== undefined;
  return {
    lineno: useInputLocation ? inputLineno ?? null : filterLineno,
    colno: useInputLocation ? inputColno ?? null : filterColno,
  };
};

const throwUndefinedPropertyError = (
  undefinedVarName: string | null,
  undefinedParentName: string,
  lineno: number | null,
  colno: number | null
): never => {
  throw createLog('error', getError('UNDEFINED_PROPERTY'), { property: undefinedVarName ?? '', parent: undefinedParentName }, undefinedVarName ?? undefined, { lineno, colno, phase: 'render', lineBase: 'zero' });
};

const throwUndefinedVariableError = (
  undefinedVarName: string | null,
  inputValue: unknown,
  lineno: number | null,
  colno: number | null
): never => {
  throw createLog('error', getError('UNDEFINED_VARIABLE'), { name: undefinedVarName ?? (inputValue as string) }, undefinedVarName ?? (inputValue as string), { lineno, colno, phase: 'render', lineBase: 'zero' });
};

const createUndefinedFilterError = (
  name: string,
  inputValue: unknown,
  strictPipeInput: boolean,
  inputLineno: number | undefined,
  inputColno: number | undefined,
  filterLineno: number | null,
  filterColno: number | null,
  context: Record<string, unknown>
): never => {
  const undefinedResult: UndefinedInputResult = detectUndefinedInput(context, inputValue);
  const { lineno, colno } = getErrorLocation(inputLineno, inputColno, filterLineno, filterColno);

  if (strictPipeInput && undefinedResult.isUndefinedInput) {
    if (undefinedResult.isPropertyLookup) {
      throwUndefinedPropertyError(undefinedResult.undefinedVarName, undefinedResult.undefinedParentName ?? '', lineno, colno);
    }
    throwUndefinedVariableError(undefinedResult.undefinedVarName, inputValue, lineno, colno);
  }

  if (undefinedResult.isUndefinedInput && undefinedResult.isPropertyLookup) {
    throwUndefinedPropertyError(undefinedResult.undefinedVarName, undefinedResult.undefinedParentName ?? '', lineno, colno);
  }

  throw createLog('error', getError('UNDEFINED_FILTER'), { name }, name, { lineno, colno, phase: 'render', lineBase: 'zero' });
};

const makeGetFilter = (
  filters: Record<string, FilterFunction>,
  context: Record<string, unknown>,
  config: GetFilterConfig,
  strictPipeInput: boolean
) => function getFilter(
  name: string,
  filterLineno: number | null,
  filterColno: number | null,
  inputLineno: number | undefined,
  inputColno: number | undefined,
  inputValue: unknown
): FilterFunction | undefined {
  const filter = lookupFilter(name, filters, context, config);
  if (filter) { return filter; }
  throw createUndefinedFilterError(name, inputValue, strictPipeInput, inputLineno, inputColno, filterLineno, filterColno, context);
};

export { makeGetFilter, lookupFilter, getErrorLocation, throwUndefinedPropertyError, throwUndefinedVariableError, createUndefinedFilterError };
export type { FilterFunction, GetFilterConfig };
