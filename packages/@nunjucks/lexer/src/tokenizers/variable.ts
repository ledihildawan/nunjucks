import { TOKEN_VARIABLE_END, TOKEN_VARIABLE_START } from '../token-types.ts';
import { createDelimiterTokenizer } from './delimiter.ts';

export const tokenizeVariableStart = createDelimiterTokenizer({
  tokenType: TOKEN_VARIABLE_START,
  stripKey: 'stripVariableStart',
  plainKey: 'variableStart',
  stripFlag: { stripLeft: true },
});
export const tokenizeVariableEnd = createDelimiterTokenizer({
  tokenType: TOKEN_VARIABLE_END,
  stripKey: 'stripVariableEnd',
  plainKey: 'variableEnd',
  stripFlag: { stripRight: true },
});
