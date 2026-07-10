export const isComplexOperator = (op, complexOps) => complexOps.includes(op);

export const isValidRegexFlag = (char, flags) => flags.includes(char);

export const isNumericString = (str) => /^[-+]?[0-9]+$/.test(str);

export const isBooleanString = (str) => /^(true|false)$/.test(str);

export const isNullString = (str) => str === 'none' || str === 'null';
