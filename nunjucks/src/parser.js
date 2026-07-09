import * as lexer from './lexer/index.js';
import * as nodes from './nodes.js';
import {
  Node,
  NodeList,
  Root,
  Literal,
  Symbol as ASTSymbol,
  Group,
  Array,
  Dict,
  FunCall,
  Caller,
  Pipe,
  PipeAsync,
  Filter,
  LookupVal,
  Compare,
  CompareOperand,
  InlineIf,
  In as OperatorIn,
  Is,
  And,
  Or,
  Not,
  Add,
  Concat,
  Sub,
  Mul,
  Div,
  FloorDiv,
  Mod,
  Pow,
  Neg,
  Pos,
  OptionalChain,
  NullishCoalesce,
  Slice,
  TemplateData,
  Block,
  Pair,
  Output,
  For,
  AsyncEach,
  AsyncAll,
  If,
  IfAsync,
  Set as ASTSet,
  Switch,
  Case,
  Import,
  FromImport,
  Include,
  Extends,
  Macro,
  Super,
  KeywordArgs,
  CallExtension,
  CallExtensionAsync,
  Capture,
  TemplateRef,
} from './nodes.js';
import { Obj } from './object.js';
import * as cursor from './parser/cursor.js';
import { parseAggregate, parseSignature } from './parser/node-parsers/index.js';
import * as exprParser from './parser/expression-parser/index.js';
import * as postfixParser from './parser/postfix-parser/index.js';
import * as stmtParser from './parser/statement-parser/index.js';

export class Parser extends Obj {
  init(tokens) {
    this.tokens = tokens;
    this.peeked = null;
    this.breakOnBlocks = null;
    this.dropLeadingWhitespace = false;
    this.extensions = [];
  }

  nextToken(withWhitespace) {
    return cursor.nextToken(this, withWhitespace);
  }

  peekToken() {
    return cursor.peekToken(this);
  }

  pushToken(tok) {
    return cursor.pushToken(this, tok);
  }

  error(msg, lineno, colno) {
    return cursor.error(this, msg, lineno, colno);
  }

  fail(msg, lineno, colno) {
    return cursor.fail(this, msg, lineno, colno);
  }

  skip(type) {
    return cursor.skip(this, type);
  }

  expect(type) {
    return cursor.expect(this, type);
  }

  skipValue(type, val) {
    return cursor.skipValue(this, type, val);
  }

  skipSymbol(val) {
    return cursor.skipSymbol(this, val);
  }

  advanceAfterBlockEnd(name) {
    return cursor.advanceAfterBlockEnd(this, name);
  }

  advanceAfterVariableEnd() {
    return cursor.advanceAfterVariableEnd(this);
  }

  parseFor() {
    return stmtParser.parseFor(this);
  }

  parseMacro() {
    return stmtParser.parseMacro(this);
  }

  parseCall() {
    return stmtParser.parseCall(this);
  }

  parseWithContext() {
    return stmtParser.parseWithContext(this);
  }

  parseImport() {
    return stmtParser.parseImport(this);
  }

  parseFrom() {
    return stmtParser.parseFrom(this);
  }

  parseBlock() {
    return stmtParser.parseBlock(this);
  }

  parseExtends() {
    return stmtParser.parseExtends(this);
  }

  parseInclude() {
    return stmtParser.parseInclude(this);
  }

  parseIf() {
    return stmtParser.parseIf(this);
  }

  parseSet() {
    return stmtParser.parseSet(this);
  }

  parseSwitch() {
    return stmtParser.parseSwitch(this);
  }

  parseStatement() {
    return stmtParser.parseStatement(this);
  }

  parseRaw(tagName) {
    return stmtParser.parseRaw(this, tagName);
  }

  parsePostfix(node) {
    return postfixParser.parsePostfix(this, node);
  }

  parseExpression() {
    return exprParser.parseExpression(this);
  }

  parseInlineIf() {
    return exprParser.parseInlineIf(this);
  }

  parseOr() {
    return exprParser.parseOr(this);
  }

  parseNullishCoalesce() {
    return exprParser.parseNullishCoalesce(this);
  }

  parseAnd() {
    return exprParser.parseAnd(this);
  }

  parseNot() {
    return exprParser.parseNot(this);
  }

  parseIn() {
    return exprParser.parseIn(this);
  }

  parseIs() {
    return exprParser.parseIs(this);
  }

  parseCompare() {
    return exprParser.parseCompare(this);
  }

  parseConcat() {
    return exprParser.parseConcat(this);
  }

  parseAdd() {
    return exprParser.parseAdd(this);
  }

  parseSub() {
    return exprParser.parseSub(this);
  }

  parseMul() {
    return exprParser.parseMul(this);
  }

  parseDiv() {
    return exprParser.parseDiv(this);
  }

  parseFloorDiv() {
    return exprParser.parseFloorDiv(this);
  }

  parseMod() {
    return exprParser.parseMod(this);
  }

  parsePow() {
    return exprParser.parsePow(this);
  }

  parseUnary(noPipes) {
    return exprParser.parseUnary(this, noPipes);
  }

  parsePrimary(noPostfix) {
    return exprParser.parsePrimary(this, noPostfix);
  }

  parseFilterName() {
    return postfixParser.parseFilterName(this);
  }

  parseFilterArgs(node) {
    return postfixParser.parseFilterArgs(this, node);
  }

  parsePipe(node) {
    return postfixParser.parsePipe(this, node);
  }

  parseFilterStatement() {
    return stmtParser.parseFilterStatement(this);
  }

  parseAggregate() {
    return parseAggregate(this);
  }

  parseSignature(tolerant, noParens) {
    return parseSignature(this, tolerant, noParens);
  }

  parseUntilBlocks(...blockNames) {
    const prev = this.breakOnBlocks;
    this.breakOnBlocks = blockNames;

    const ret = this.parse();

    this.breakOnBlocks = prev;
    return ret;
  }

  parseNodes() {
    let tok;
    const buf = [];

    while ((tok = this.nextToken())) {
      if (tok.type === lexer.TOKEN_DATA) {
        let data = tok.value;
        const nextToken = this.peekToken();
        const nextVal = nextToken && nextToken.value;

        // If the last token has "-" we need to trim the
        // leading whitespace of the data. This is marked with
        // the `dropLeadingWhitespace` variable.
        if (this.dropLeadingWhitespace) {
          // TODO: this could be optimized (don't use regex)
          data = data.replace(/^\s*/, '');
          this.dropLeadingWhitespace = false;
        }

        // Same for the succeeding block start token
        if (nextToken &&
          ((nextToken.type === lexer.TOKEN_BLOCK_START &&
          nextVal.charAt(nextVal.length - 1) === '-') ||
          (nextToken.type === lexer.TOKEN_VARIABLE_START &&
          nextVal.charAt(this.tokens.tags.VARIABLE_START.length)
          === '-') ||
          (nextToken.type === lexer.TOKEN_COMMENT &&
          nextVal.charAt(this.tokens.tags.COMMENT_START.length)
          === '-'))) {
          // TODO: this could be optimized (don't use regex)
          data = data.replace(/\s*$/, '');
        }

        buf.push(new Output(tok.lineno,
          tok.colno,
          [new TemplateData(tok.lineno,
            tok.colno,
            data)]));
      } else if (tok.type === lexer.TOKEN_BLOCK_START) {
        this.dropLeadingWhitespace = false;
        const n = this.parseStatement();
        if (!n) {
          break;
        }
        buf.push(n);
      } else if (tok.type === lexer.TOKEN_VARIABLE_START) {
        const e = this.parseExpression();
        this.dropLeadingWhitespace = false;
        this.advanceAfterVariableEnd();
        buf.push(new Output(tok.lineno, tok.colno, [e]));
      } else if (tok.type === lexer.TOKEN_COMMENT) {
        this.dropLeadingWhitespace = tok.value.charAt(
          tok.value.length - this.tokens.tags.COMMENT_END.length - 1
        ) === '-';
      } else {
        // Ignore comments, otherwise this should be an error
        this.fail('Unexpected token at top-level: ' +
          tok.type, tok.lineno, tok.colno);
      }
    }

    return buf;
  }

  parse() {
    return new NodeList(0, 0, this.parseNodes());
  }

  parseAsRoot() {
    return new Root(0, 0, this.parseNodes());
  }
}

export function parse(src, extensions, opts) {
  const p = new Parser(lexer.lex(src, opts));
  if (extensions !== undefined) {
    p.extensions = extensions;
  }
  return p.parseAsRoot();
}
