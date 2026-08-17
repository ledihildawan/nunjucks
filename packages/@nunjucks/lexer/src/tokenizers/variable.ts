import { TOKEN_VARIABLE_END, TOKEN_VARIABLE_START } from '../token-types.ts';
import { createDelimiterTokenizer } from './delimiter.ts';

/** Tokenizes `{{` and its strip form `{{-`, flagging `stripLeft` for the strip variant. */
export const tokenizeVariableStart = createDelimiterTokenizer({
  tokenType: TOKEN_VARIABLE_START,
  stripKey: 'stripVariableStart',
  plainKey: 'variableStart',
  stripFlag: { stripLeft: true },
});
/** Tokenizes `}}` and its strip form `-}}`, flagging `stripRight` for the strip variant. */
export const tokenizeVariableEnd = createDelimiterTokenizer({
  tokenType: TOKEN_VARIABLE_END,
  stripKey: 'stripVariableEnd',
  plainKey: 'variableEnd',
  stripFlag: { stripRight: true },
});
