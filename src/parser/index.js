import { lex } from '../lexer/tokenizer.js';
import {
  nodes,
} from '../nodes/index.js';
import { createObj } from '../object/index.js';
import {
  nextToken,
  peekToken,
  pushToken,
  skip,
  expect,
  skipValue,
  skipSymbol,
  advanceAfterBlockEnd,
  advanceAfterVariableEnd,
  error,
  fail,
} from './cursor.js';
import { parseAggregate, parseSignature, parseTemplateLiteral, parsePattern, tryParsePattern } from './node-parsers/index.js';
import {
  parseExpression,
  parseInlineIf,
  parseOr,
  parseNullishCoalesce,
  parseAnd,
  parseNot,
  parseIn,
  parseIs,
  parseCompare,
  parseConcat,
  parseAdd,
  parseSub,
  parseMul,
  parseDiv,
  parseFloorDiv,
  parseMod,
  parsePow,
  parseUnary,
  parsePrimary,
} from './expression-parser/index.js';
import {
  parsePostfix,
  parseFilterName,
  parseFilterArgs,
  parsePipe,
} from './postfix-parser/index.js';
import {
  parseStatement,
  parseFor,
  parseMacro,
  parseCall,
  parseWithContext,
  parseImport,
  parseFrom,
  parseBlock,
  parseExtends,
  parseInclude,
  parseIf,
  parseSwitch,
  parseRaw,
  parseFilterStatement,
  parseVariableDeclaration,
  parseVariableAssignment,
  parseDefineBlock,
} from './statement-parser/index.js';
import { parseNodes, parseUntilBlocks } from './top-level.js';
import { validateExpression, DEFAULT_SECURITY_CONFIG } from '../shared/expression-validator.js';

export function createParser(tokens, securityConfig = {}) {
  const obj = createObj({
    name: 'Parser',
    init: function(tok) {
      this.tokens = tok;
      this.peeked = null;
      this.breakOnBlocks = null;
      this.dropLeadingWhitespace = false;
      this.extensions = [];
      this.securityConfig = { ...DEFAULT_SECURITY_CONFIG, ...securityConfig };
    },
    nextToken: function(withWhitespace) {
      return nextToken(this, withWhitespace);
    },
    peekToken: function() {
      return peekToken(this);
    },
    pushToken: function(tok) {
      return pushToken(this, tok);
    },
    error: function(msg, lineno, colno) {
      return error(this, msg, lineno, colno);
    },
    fail: function(msg, lineno, colno) {
      return fail(this, msg, lineno, colno);
    },
    skip: function(type) {
      return skip(this, type);
    },
    expect: function(type) {
      return expect(this, type);
    },
    skipValue: function(type, val) {
      return skipValue(this, type, val);
    },
    skipSymbol: function(val) {
      return skipSymbol(this, val);
    },
    advanceAfterBlockEnd: function(name) {
      return advanceAfterBlockEnd(this, name);
    },
    advanceAfterVariableEnd: function() {
      return advanceAfterVariableEnd(this);
    },
    parseFor: function() {
      return parseFor(this);
    },
    parseMacro: function() {
      return parseMacro(this);
    },
    parseCall: function() {
      return parseCall(this);
    },
    parseWithContext: function() {
      return parseWithContext(this);
    },
    parseImport: function() {
      return parseImport(this);
    },
    parseFrom: function() {
      return parseFrom(this);
    },
    parseBlock: function() {
      return parseBlock(this);
    },
    parseExtends: function() {
      return parseExtends(this);
    },
    parseInclude: function() {
      return parseInclude(this);
    },
    parseIf: function() {
      return parseIf(this);
    },
    parseSwitch: function() {
      return parseSwitch(this);
    },
    parseVariableDeclaration: function() {
      return parseVariableDeclaration(this);
    },
    parseVariableAssignment: function() {
      return parseVariableAssignment(this);
    },
    parseDefineBlock: function() {
      return parseDefineBlock(this);
    },
    parseStatement: function() {
      return parseStatement(this);
    },
    parseRaw: function(tagName) {
      return parseRaw(this, tagName);
    },
    parsePostfix: function(node) {
      return parsePostfix(this, node);
    },
    parseExpression: function() {
      return parseExpression(this);
    },
    parseInlineIf: function() {
      return parseInlineIf(this);
    },
    parseOr: function() {
      return parseOr(this);
    },
    parseNullishCoalesce: function() {
      return parseNullishCoalesce(this);
    },
    parseAnd: function() {
      return parseAnd(this);
    },
    parseNot: function() {
      return parseNot(this);
    },
    parseIn: function() {
      return parseIn(this);
    },
    parseIs: function() {
      return parseIs(this);
    },
    parseCompare: function() {
      return parseCompare(this);
    },
    parseConcat: function() {
      return parseConcat(this);
    },
    parseAdd: function() {
      return parseAdd(this);
    },
    parseSub: function() {
      return parseSub(this);
    },
    parseMul: function() {
      return parseMul(this);
    },
    parseDiv: function() {
      return parseDiv(this);
    },
    parseFloorDiv: function() {
      return parseFloorDiv(this);
    },
    parseMod: function() {
      return parseMod(this);
    },
    parsePow: function() {
      return parsePow(this);
    },
    parseUnary: function(noPipes) {
      return parseUnary(this, noPipes);
    },
    parsePrimary: function(noPostfix) {
      return parsePrimary(this, noPostfix);
    },
    parseFilterName: function() {
      return parseFilterName(this);
    },
    parseFilterArgs: function(node) {
      return parseFilterArgs(this, node);
    },
    parsePipe: function(node) {
      return parsePipe(this, node);
    },
    parseFilterStatement: function() {
      return parseFilterStatement(this);
    },
    parseAggregate: function() {
      return parseAggregate(this);
    },
    parseTemplateLiteral: function() {
      return parseTemplateLiteral(this);
    },
    parsePattern: function() {
      return parsePattern(this);
    },
    tryParsePattern: function() {
      return tryParsePattern(this);
    },
    parseSignature: function(tolerant, noParens) {
      return parseSignature(this, tolerant, noParens);
    },
    parseUntilBlocks: function(...blockNames) {
      return parseUntilBlocks(this, ...blockNames);
    },
    parseNodes: function() {
      return parseNodes(this);
    },
    parse: function() {
      return nodes.nodeList(0, 0, this.parseNodes());
    },
    parseAsRoot: function() {
      return nodes.root(0, 0, this.parseNodes());
    },
  });
  obj.init(tokens);
  return obj;
}

export function parse(src, extensions, opts) {
  const securityConfig = opts?.security ?? null;
  const p = createParser(lex(src, opts), securityConfig ?? {});
  if (extensions !== undefined) {
    p.extensions = extensions;
  }
  const ast = p.parseAsRoot();

  if (securityConfig !== null) {
    const errors = validateExpression(ast, securityConfig);
    if (errors.length > 0) {
      const firstError = errors[0];
      fail(p, firstError.message, firstError.lineno, firstError.colno);
    }
  }

  return ast;
}
