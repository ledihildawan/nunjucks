import {
  TOKEN_STRING,
  TOKEN_WHITESPACE,
  TOKEN_DATA,
  TOKEN_BLOCK_START,
  TOKEN_BLOCK_END,
  TOKEN_VARIABLE_START,
  TOKEN_VARIABLE_END,
  TOKEN_COMMENT,
  TOKEN_LEFT_PAREN,
  TOKEN_RIGHT_PAREN,
  TOKEN_LEFT_BRACKET,
  TOKEN_RIGHT_BRACKET,
  TOKEN_LEFT_CURLY,
  TOKEN_RIGHT_CURLY,
  TOKEN_OPERATOR,
  TOKEN_COMMA,
  TOKEN_COLON,
  TOKEN_TILDE,
  TOKEN_PIPEFORWARD,
  TOKEN_INT,
  TOKEN_FLOAT,
  TOKEN_BOOLEAN,
  TOKEN_NONE,
  TOKEN_SYMBOL,
  TOKEN_REGEX,
} from './token-types.js';

export const createToken = (type, value, lineno, colno) => ({
  type,
  value,
  lineno,
  colno,
});

export const parseEscapeChar = (char) => {
  const escapes = { n: '\n', t: '\t', r: '\r' };
  return escapes[char] ?? char;
};

export const isComplexOperator = (op, complexOps) => complexOps.includes(op);

export const isValidRegexFlag = (char, flags) => flags.includes(char);

export const isNumericString = (str) => /^[-+]?[0-9]+$/.test(str);

export const isBooleanString = (str) => /^(true|false)$/.test(str);

export const isNullString = (str) => str === 'none' || str === 'null';

export const matchTokenType = (char) => {
  const tokenMap = {
    '(' : TOKEN_LEFT_PAREN,
    ')' : TOKEN_RIGHT_PAREN,
    '[' : TOKEN_LEFT_BRACKET,
    ']' : TOKEN_RIGHT_BRACKET,
    '{' : TOKEN_LEFT_CURLY,
    '}' : TOKEN_RIGHT_CURLY,
    ',' : TOKEN_COMMA,
    ':' : TOKEN_COLON,
    '~' : TOKEN_TILDE,
    '|>' : TOKEN_PIPEFORWARD,
  };
  return tokenMap[char] ?? TOKEN_OPERATOR;
};

export const createOperatorToken = (char, lineno, colno) => 
  createToken(matchTokenType(char), char, lineno, colno);

export const createNumberToken = (tok, lineno, colno, hasDecimal) => 
  createToken(hasDecimal ? TOKEN_FLOAT : TOKEN_INT, tok, lineno, colno);

export const createSymbolToken = (tok, lineno, colno) => {
  if (isNumericString(tok)) return null;
  if (isBooleanString(tok)) return createToken(TOKEN_BOOLEAN, tok, lineno, colno);
  if (isNullString(tok)) return createToken(TOKEN_NONE, tok, lineno, colno);
  if (tok) return createToken(TOKEN_SYMBOL, tok, lineno, colno);
  return null;
};

export const extractBeginChars = (tags) => 
  tags.BLOCK_START.charAt(0) + 
  tags.VARIABLE_START.charAt(0) + 
  tags.COMMENT_START.charAt(0) + 
  tags.COMMENT_END.charAt(0);

export const extractWhileInCharSet = (str, startIndex, charSet) => {
  let result = '';
  for (let i = startIndex; i < str.length; i++) {
    if (charSet.indexOf(str[i]) === -1) break;
    result += str[i];
  }
  return result;
};

export const extractUntilCharSet = (str, startIndex, charSet) => {
  let result = '';
  for (let i = startIndex; i < str.length; i++) {
    if (charSet.indexOf(str[i]) !== -1) break;
    result += str[i];
  }
  return result;
};

export const parseStringContent = (str, startIndex, delimiter) => {
  let result = '';
  for (let i = startIndex; i < str.length; i++) {
    const char = str[i];
    if (char === '\\' && i + 1 < str.length) {
      result += parseEscapeChar(str[i + 1]);
      i++;
    } else if (char === delimiter) {
      break;
    } else {
      result += char;
    }
  }
  return result;
};

export const parseRegexContent = (str, startIndex, flags) => {
  let body = '';
  let i = startIndex;
  
  for (; i < str.length; i++) {
    if (str[i] === '/' && str[i - 1] !== '\\') break;
    body += str[i];
  }
  
  i++;
  
  let extractedFlags = '';
  for (; i < str.length; i++) {
    if (isValidRegexFlag(str[i], flags)) {
      extractedFlags += str[i];
    } else {
      break;
    }
  }
  
  return { body, flags: extractedFlags, consumed: i - startIndex };
};
