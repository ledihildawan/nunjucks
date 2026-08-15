export const TOKEN_STRING = 'string';
export const TOKEN_WHITESPACE = 'whitespace';
export const TOKEN_DATA = 'data';
export const TOKEN_BLOCK_START = 'block-start';
export const TOKEN_BLOCK_END = 'block-end';
export const TOKEN_VARIABLE_START = 'variable-start';
export const TOKEN_VARIABLE_END = 'variable-end';
export const TOKEN_COMMENT = 'comment';
export const TOKEN_RAW = 'raw';
export const TOKEN_LEFT_PAREN = 'left-paren';
export const TOKEN_RIGHT_PAREN = 'right-paren';
export const TOKEN_LEFT_BRACKET = 'left-bracket';
export const TOKEN_RIGHT_BRACKET = 'right-bracket';
export const TOKEN_LEFT_CURLY = 'left-curly';
export const TOKEN_RIGHT_CURLY = 'right-curly';
export const TOKEN_OPERATOR = 'operator';
export const TOKEN_SPREAD = 'spread';
export const TOKEN_COMMA = 'comma';
export const TOKEN_COLON = 'colon';
export const TOKEN_TILDE = 'tilde';
export const TOKEN_PIPEFORWARD = 'pipe-forward';
export const TOKEN_INT = 'int';
export const TOKEN_FLOAT = 'float';
export const TOKEN_BOOLEAN = 'boolean';
export const TOKEN_NONE = 'none';
export const TOKEN_SYMBOL = 'symbol';
export const TOKEN_REGEX = 'regex';
export const TOKEN_TEMPLATE_LITERAL = 'template-literal';

export const TOKEN_TYPES = {
  STRING: TOKEN_STRING,
  WHITESPACE: TOKEN_WHITESPACE,
  DATA: TOKEN_DATA,
  BLOCK_START: TOKEN_BLOCK_START,
  BLOCK_END: TOKEN_BLOCK_END,
  VARIABLE_START: TOKEN_VARIABLE_START,
  VARIABLE_END: TOKEN_VARIABLE_END,
  COMMENT: TOKEN_COMMENT,
  RAW: TOKEN_RAW,
  LEFT_PAREN: TOKEN_LEFT_PAREN,
  RIGHT_PAREN: TOKEN_RIGHT_PAREN,
  LEFT_BRACKET: TOKEN_LEFT_BRACKET,
  RIGHT_BRACKET: TOKEN_RIGHT_BRACKET,
  LEFT_CURLY: TOKEN_LEFT_CURLY,
  RIGHT_CURLY: TOKEN_RIGHT_CURLY,
  OPERATOR: TOKEN_OPERATOR,
  SPREAD: TOKEN_SPREAD,
  COMMA: TOKEN_COMMA,
  COLON: TOKEN_COLON,
  TILDE: TOKEN_TILDE,
  PIPEFORWARD: TOKEN_PIPEFORWARD,
  INT: TOKEN_INT,
  FLOAT: TOKEN_FLOAT,
  BOOLEAN: TOKEN_BOOLEAN,
  NONE: TOKEN_NONE,
  SYMBOL: TOKEN_SYMBOL,
  REGEX: TOKEN_REGEX,
  TEMPLATE_LITERAL: TOKEN_TEMPLATE_LITERAL,
} as const;

export type TokenType = (typeof TOKEN_TYPES)[keyof typeof TOKEN_TYPES];

export interface TemplateQuasi {
  type: 'template' | 'expression';
  value: string;
}

interface TokenBase {
  lineno: number;
  colno: number;
  stripLeft?: boolean;
  stripRight?: boolean;
}

export type TokenValueByType = {
  [TOKEN_STRING]: string;
  [TOKEN_WHITESPACE]: string;
  [TOKEN_DATA]: string;
  [TOKEN_BLOCK_START]: string;
  [TOKEN_BLOCK_END]: string;
  [TOKEN_VARIABLE_START]: string;
  [TOKEN_VARIABLE_END]: string;
  [TOKEN_COMMENT]: string;
  [TOKEN_RAW]: string;
  [TOKEN_LEFT_PAREN]: string;
  [TOKEN_RIGHT_PAREN]: string;
  [TOKEN_LEFT_BRACKET]: string;
  [TOKEN_RIGHT_BRACKET]: string;
  [TOKEN_LEFT_CURLY]: string;
  [TOKEN_RIGHT_CURLY]: string;
  [TOKEN_OPERATOR]: string;
  [TOKEN_SPREAD]: string;
  [TOKEN_COMMA]: string;
  [TOKEN_COLON]: string;
  [TOKEN_TILDE]: string;
  [TOKEN_PIPEFORWARD]: string;
  [TOKEN_INT]: number;
  [TOKEN_FLOAT]: number;
  [TOKEN_BOOLEAN]: string;
  [TOKEN_NONE]: string;
  [TOKEN_SYMBOL]: string;
  [TOKEN_REGEX]: { body: string; flags: string };
  [TOKEN_TEMPLATE_LITERAL]: { quasis: TemplateQuasi[]; expressions: [] };
};

export type Token = TokenBase &
  {
    [K in TokenType]: { type: K; value: TokenValueByType[K] };
  }[TokenType];
