import type { TokenType } from '../token-types.ts';
import { createDelimiterTokenizer } from './delimiter.ts';

export const tokenizeVariableStart = createDelimiterTokenizer(
  'variable-start' as TokenType, 'STRIP_VARIABLE_START', 'VARIABLE_START', { stripLeft: true },
);
export const tokenizeVariableEnd = createDelimiterTokenizer(
  'variable-end' as TokenType, 'STRIP_VARIABLE_END', 'VARIABLE_END', { stripRight: true },
);
