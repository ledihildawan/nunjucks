import { TOKEN_VARIABLE_START, TOKEN_VARIABLE_END } from '../token-types.ts';
import { createDelimiterTokenizer } from './delimiter.ts';

export const tokenizeVariableStart = createDelimiterTokenizer(
  TOKEN_VARIABLE_START, 'stripVariableStart', 'variableStart', { stripLeft: true },
);
export const tokenizeVariableEnd = createDelimiterTokenizer(
  TOKEN_VARIABLE_END, 'stripVariableEnd', 'variableEnd', { stripRight: true },
);
