import { pipe, join } from 'remeda';

interface UndefinedInputResult {
  isUndefinedInput: boolean;
  undefinedVarName: string | null;
  undefinedParentName: string | null;
  isPropertyLookup: boolean;
}


const detectNullInput = (_inputValue: unknown): UndefinedInputResult => ({
  isUndefinedInput: true,
  undefinedVarName: '<null>',
  undefinedParentName: null,
  isPropertyLookup: false,
});

const detectNonStringInput = (): UndefinedInputResult => ({
  isUndefinedInput: false,
  undefinedVarName: null,
  undefinedParentName: null,
  isPropertyLookup: false,
});

const isUndefinedOrNull = (val: unknown): boolean => val === undefined || val === null;

const findUndefinedAt = (context: unknown, parts: string[]): number => {
  let val: unknown = context;
  for (let i = 0; i < parts.length; i += 1) {
    if (isUndefinedOrNull(val)) {
      return i;
    }
    try {
      val = (val as Record<string, unknown>)[parts[i] ?? ''];
    } catch (e) {
      if (e instanceof TypeError) {
        return i;
      }
      throw e;
    }
  }
  return isUndefinedOrNull(val) ? parts.length - 1 : -1;
};

const detectUndefinedInput = (context: unknown, inputValue: unknown): UndefinedInputResult => {
  if (inputValue === null) {
    return detectNullInput(inputValue);
  }

  if (typeof inputValue !== 'string') {
    return detectNonStringInput();
  }

  const parts = inputValue.split('.');
  const isPropertyLookup = parts.length > 1;

  try {
    const undefinedAt = findUndefinedAt(context, parts);
    if (undefinedAt >= 0) {
      return {
        isUndefinedInput: true,
        undefinedVarName: pipe(parts, (arr: string[]) => arr.slice(undefinedAt), join('.')),
        undefinedParentName: undefinedAt > 0 ? parts[undefinedAt - 1] ?? null : null,
        isPropertyLookup,
      };
    }
  } catch (e) {
    if (e instanceof TypeError) {
      return {
        isUndefinedInput: true,
        undefinedVarName: inputValue,
        undefinedParentName: null,
        isPropertyLookup,
      };
    }
    throw e;
  }

  return {
    isUndefinedInput: false,
    undefinedVarName: null,
    undefinedParentName: null,
    isPropertyLookup,
  };
};

export type { UndefinedInputResult };
export { detectUndefinedInput, detectNullInput, detectNonStringInput, isUndefinedOrNull, findUndefinedAt };
