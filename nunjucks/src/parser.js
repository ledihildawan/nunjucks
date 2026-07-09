import { lex } from './lexer/tokenizer.js';
import {
  NodeList,
  Root,
  Output,
  TemplateData,
} from './nodes.js';
import { Obj } from './object/index.js';
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
} from './parser/cursor.js';
import { parseAggregate, parseSignature } from './parser/node-parsers/index.js';
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
} from './parser/expression-parser/index.js';
import {
  parsePostfix,
  parseFilterName,
  parseFilterArgs,
  parsePipe,
} from './parser/postfix-parser/index.js';
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
  parseSet,
  parseSwitch,
  parseRaw,
  parseFilterStatement,
} from './parser/statement-parser/index.js';
import { parseNodes, parseUntilBlocks } from './parser/top-level-parser.js';

export class Parser extends Obj {
  init(tokens) {
    this.tokens = tokens;
    this.peeked = null;
    this.breakOnBlocks = null;
    this.dropLeadingWhitespace = false;
    this.extensions = [];
  }

  nextToken(withWhitespace) {
    return nextToken(this, withWhitespace);
  }

  peekToken() {
    return peekToken(this);
  }

  pushToken(tok) {
    return pushToken(this, tok);
  }

  error(msg, lineno, colno) {
    return error(this, msg, lineno, colno);
  }

  fail(msg, lineno, colno) {
    return fail(this, msg, lineno, colno);
  }

  skip(type) {
    return skip(this, type);
  }

  expect(type) {
    return expect(this, type);
  }

  skipValue(type, val) {
    return skipValue(this, type, val);
  }

  skipSymbol(val) {
    return skipSymbol(this, val);
  }

  advanceAfterBlockEnd(name) {
    return advanceAfterBlockEnd(this, name);
  }

  advanceAfterVariableEnd() {
    return advanceAfterVariableEnd(this);
  }

  parseFor() {
    return parseFor(this);
  }

  parseMacro() {
    return parseMacro(this);
  }

  parseCall() {
    return parseCall(this);
  }

  parseWithContext() {
    return parseWithContext(this);
  }

  parseImport() {
    return parseImport(this);
  }

  parseFrom() {
    return parseFrom(this);
  }

  parseBlock() {
    return parseBlock(this);
  }

  parseExtends() {
    return parseExtends(this);
  }

  parseInclude() {
    return parseInclude(this);
  }

  parseIf() {
    return parseIf(this);
  }

  parseSet() {
    return parseSet(this);
  }

  parseSwitch() {
    return parseSwitch(this);
  }

  parseStatement() {
    return parseStatement(this);
  }

  parseRaw(tagName) {
    return parseRaw(this, tagName);
  }

  parsePostfix(node) {
    return parsePostfix(this, node);
  }

  parseExpression() {
    return parseExpression(this);
  }

  parseInlineIf() {
    return parseInlineIf(this);
  }

  parseOr() {
    return parseOr(this);
  }

  parseNullishCoalesce() {
    return parseNullishCoalesce(this);
  }

  parseAnd() {
    return parseAnd(this);
  }

  parseNot() {
    return parseNot(this);
  }

  parseIn() {
    return parseIn(this);
  }

  parseIs() {
    return parseIs(this);
  }

  parseCompare() {
    return parseCompare(this);
  }

  parseConcat() {
    return parseConcat(this);
  }

  parseAdd() {
    return parseAdd(this);
  }

  parseSub() {
    return parseSub(this);
  }

  parseMul() {
    return parseMul(this);
  }

  parseDiv() {
    return parseDiv(this);
  }

  parseFloorDiv() {
    return parseFloorDiv(this);
  }

  parseMod() {
    return parseMod(this);
  }

  parsePow() {
    return parsePow(this);
  }

  parseUnary(noPipes) {
    return parseUnary(this, noPipes);
  }

  parsePrimary(noPostfix) {
    return parsePrimary(this, noPostfix);
  }

  parseFilterName() {
    return parseFilterName(this);
  }

  parseFilterArgs(node) {
    return parseFilterArgs(this, node);
  }

  parsePipe(node) {
    return parsePipe(this, node);
  }

  parseFilterStatement() {
    return parseFilterStatement(this);
  }

  parseAggregate() {
    return parseAggregate(this);
  }

  parseSignature(tolerant, noParens) {
    return parseSignature(this, tolerant, noParens);
  }

  parseUntilBlocks(...blockNames) {
    return parseUntilBlocks(this, ...blockNames);
  }

  parseNodes() {
    return parseNodes(this);
  }

  parse() {
    return new NodeList(0, 0, this.parseNodes());
  }

  parseAsRoot() {
    return new Root(0, 0, this.parseNodes());
  }
}

export function parse(src, extensions, opts) {
  const p = new Parser(lex(src, opts));
  if (extensions !== undefined) {
    p.extensions = extensions;
  }
  return p.parseAsRoot();
}
