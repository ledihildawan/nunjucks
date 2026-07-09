import * as lexer from '../lexer/index.js';
import * as nodes from '../nodes.js';
import {
  For,
  AsyncEach,
  AsyncAll,
  Macro,
  Caller,
  NodeList,
  Pair,
  KeywordArgs,
  Output,
  Import,
  FromImport,
  Block,
  Extends,
  Include,
  If,
  IfAsync,
  Set as ASTSet,
  Capture,
  Switch,
  Case,
  TemplateData,
  Symbol as ASTSymbol,
} from '../nodes.js';
import {
  nextToken,
  peekToken,
  pushToken,
  skip,
  skipValue,
  skipSymbol,
  advanceAfterBlockEnd,
  fail,
} from './cursor.js';

export const parseFor = (ctx) => {
  const forTok = peekToken(ctx);
  let node;
  let endBlock;

  if (skipSymbol(ctx, 'for')) {
    node = new For(forTok.lineno, forTok.colno);
    endBlock = 'endfor';
  } else if (skipSymbol(ctx, 'asyncEach')) {
    node = new AsyncEach(forTok.lineno, forTok.colno);
    endBlock = 'endeach';
  } else if (skipSymbol(ctx, 'asyncAll')) {
    node = new AsyncAll(forTok.lineno, forTok.colno);
    endBlock = 'endall';
  } else {
    fail(ctx, 'parseFor: expected for{Async}', forTok.lineno, forTok.colno);
  }

  node.name = ctx.parsePrimary();

  if (!(node.name instanceof ASTSymbol)) {
    fail(ctx, 'parseFor: variable name expected for loop');
  }

  const type = peekToken(ctx).type;
  if (type === lexer.TOKEN_COMMA) {
    const key = node.name;
    node.name = new nodes.Array(key.lineno, key.colno);
    node.name.addChild(key);

    while (skip(ctx, lexer.TOKEN_COMMA)) {
      const prim = ctx.parsePrimary();
      node.name.addChild(prim);
    }
  }

  if (!skipSymbol(ctx, 'in')) {
    fail(ctx, 'parseFor: expected "in" keyword for loop',
      forTok.lineno,
      forTok.colno);
  }

  node.arr = ctx.parseExpression();
  advanceAfterBlockEnd(ctx, forTok.value);

  node.body = ctx.parseUntilBlocks(endBlock, 'else');

  if (skipSymbol(ctx, 'else')) {
    advanceAfterBlockEnd(ctx, 'else');
    node.else_ = ctx.parseUntilBlocks(endBlock);
  }

  advanceAfterBlockEnd(ctx);

  return node;
};

export const parseMacro = (ctx) => {
  const macroTok = peekToken(ctx);
  if (!skipSymbol(ctx, 'macro')) {
    fail(ctx, 'expected macro');
  }

  const name = ctx.parsePrimary(true);
  const args = ctx.parseSignature();
  const node = new Macro(macroTok.lineno, macroTok.colno, name, args);

  advanceAfterBlockEnd(ctx, macroTok.value);
  node.body = ctx.parseUntilBlocks('endmacro');
  advanceAfterBlockEnd(ctx);

  return node;
};

export const parseCall = (ctx) => {
  const callTok = peekToken(ctx);
  if (!skipSymbol(ctx, 'call')) {
    fail(ctx, 'expected call');
  }

  const callerArgs = ctx.parseSignature(true) || new NodeList();
  const macroCall = ctx.parsePrimary();

  advanceAfterBlockEnd(ctx, callTok.value);
  const body = ctx.parseUntilBlocks('endcall');
  advanceAfterBlockEnd(ctx);

  const callerName = new ASTSymbol(callTok.lineno,
    callTok.colno,
    'caller');
  const callerNode = new Caller(callTok.lineno,
    callTok.colno,
    callerName,
    callerArgs,
    body);

  const args = macroCall.args.children;
  if (!(args[args.length - 1] instanceof KeywordArgs)) {
    args.push(new KeywordArgs());
  }
  const kwargs = args[args.length - 1];
  kwargs.addChild(new Pair(callTok.lineno,
    callTok.colno,
    callerName,
    callerNode));

  return new Output(callTok.lineno,
    callTok.colno,
    [macroCall]);
};

export const parseWithContext = (ctx) => {
  const tok = peekToken(ctx);

  let withContext = null;

  if (skipSymbol(ctx, 'with')) {
    withContext = true;
  } else if (skipSymbol(ctx, 'without')) {
    withContext = false;
  }

  if (withContext !== null) {
    if (!skipSymbol(ctx, 'context')) {
      fail(ctx, 'parseFrom: expected context after with/without',
        tok.lineno,
        tok.colno);
    }
  }

  return withContext;
};

export const parseImport = (ctx) => {
  const importTok = peekToken(ctx);
  if (!skipSymbol(ctx, 'import')) {
    fail(ctx, 'parseImport: expected import',
      importTok.lineno,
      importTok.colno);
  }

  const template = ctx.parseExpression();

  if (!skipSymbol(ctx, 'as')) {
    fail(ctx, 'parseImport: expected "as" keyword',
      importTok.lineno,
      importTok.colno);
  }

  const target = ctx.parseExpression();
  const withContext = parseWithContext(ctx);
  const node = new Import(importTok.lineno,
    importTok.colno,
    template,
    target,
    withContext);

  advanceAfterBlockEnd(ctx, importTok.value);

  return node;
};

export const parseFrom = (ctx) => {
  const fromTok = peekToken(ctx);
  if (!skipSymbol(ctx, 'from')) {
    fail(ctx, 'parseFrom: expected from');
  }

  const template = ctx.parseExpression();

  if (!skipSymbol(ctx, 'import')) {
    fail(ctx, 'parseFrom: expected import',
      fromTok.lineno,
      fromTok.colno);
  }

  const names = new NodeList();
  let withContext;

  while (1) {
    const nextTok = peekToken(ctx);
    if (nextTok.type === lexer.TOKEN_BLOCK_END) {
      if (!names.children.length) {
        fail(ctx, 'parseFrom: Expected at least one import name',
          fromTok.lineno,
          fromTok.colno);
      }

      if (nextTok.value.charAt(0) === '-') {
        ctx.dropLeadingWhitespace = true;
      }

      nextToken(ctx);
      break;
    }

    if (names.children.length > 0 && !skip(ctx, lexer.TOKEN_COMMA)) {
      fail(ctx, 'parseFrom: expected comma',
        fromTok.lineno,
        fromTok.colno);
    }

    const name = ctx.parsePrimary();
    if (name.value.charAt(0) === '_') {
      fail(ctx, 'parseFrom: names starting with an underscore cannot be imported',
        name.lineno,
        name.colno);
    }

    if (skipSymbol(ctx, 'as')) {
      const alias = ctx.parsePrimary();
      names.addChild(new Pair(name.lineno,
        name.colno,
        name,
        alias));
    } else {
      names.addChild(name);
    }

    withContext = parseWithContext(ctx);
  }

  return new FromImport(fromTok.lineno,
    fromTok.colno,
    template,
    names,
    withContext);
};

export const parseBlock = (ctx) => {
  const tag = peekToken(ctx);
  if (!skipSymbol(ctx, 'block')) {
    fail(ctx, 'parseBlock: expected block', tag.lineno, tag.colno);
  }

  const node = new Block(tag.lineno, tag.colno);

  node.name = ctx.parsePrimary();
  if (!(node.name instanceof ASTSymbol)) {
    fail(ctx, 'parseBlock: variable name expected',
      tag.lineno,
      tag.colno);
  }

  advanceAfterBlockEnd(ctx, tag.value);

  node.body = ctx.parseUntilBlocks('endblock');
  skipSymbol(ctx, 'endblock');
  skipSymbol(ctx, node.name.value);

  const tok = peekToken(ctx);
  if (!tok) {
    fail(ctx, 'parseBlock: expected endblock, got end of file');
  }

  advanceAfterBlockEnd(ctx, tok.value);

  return node;
};

export const parseExtends = (ctx) => {
  const tagName = 'extends';
  const tag = peekToken(ctx);
  if (!skipSymbol(ctx, tagName)) {
    fail(ctx, 'parseTemplateRef: expected ' + tagName);
  }

  const node = new Extends(tag.lineno, tag.colno);
  node.template = ctx.parseExpression();

  advanceAfterBlockEnd(ctx, tag.value);
  return node;
};

export const parseInclude = (ctx) => {
  const tagName = 'include';
  const tag = peekToken(ctx);
  if (!skipSymbol(ctx, tagName)) {
    fail(ctx, 'parseInclude: expected ' + tagName);
  }

  const node = new Include(tag.lineno, tag.colno);
  node.template = ctx.parseExpression();

  if (skipSymbol(ctx, 'ignore') && skipSymbol(ctx, 'missing')) {
    node.ignoreMissing = true;
  }

  advanceAfterBlockEnd(ctx, tag.value);
  return node;
};

export const parseIf = (ctx) => {
  const tag = peekToken(ctx);
  let node;

  if (skipSymbol(ctx, 'if') || skipSymbol(ctx, 'elif') || skipSymbol(ctx, 'elseif')) {
    node = new If(tag.lineno, tag.colno);
  } else if (skipSymbol(ctx, 'ifAsync')) {
    node = new IfAsync(tag.lineno, tag.colno);
  } else {
    fail(ctx, 'parseIf: expected if, elif, or elseif',
      tag.lineno,
      tag.colno);
  }

  node.cond = ctx.parseExpression();
  advanceAfterBlockEnd(ctx, tag.value);

  node.body = ctx.parseUntilBlocks('elif', 'elseif', 'else', 'endif');
  const tok = peekToken(ctx);

  switch (tok && tok.value) {
    case 'elseif':
    case 'elif':
      node.else_ = parseIf(ctx);
      break;
    case 'else':
      advanceAfterBlockEnd(ctx);
      node.else_ = ctx.parseUntilBlocks('endif');
      advanceAfterBlockEnd(ctx);
      break;
    case 'endif':
      node.else_ = null;
      advanceAfterBlockEnd(ctx);
      break;
    default:
      fail(ctx, 'parseIf: expected elif, else, or endif, got end of file');
  }

  return node;
};

export const parseSet = (ctx) => {
  const tag = peekToken(ctx);
  if (!skipSymbol(ctx, 'set')) {
    fail(ctx, 'parseSet: expected set', tag.lineno, tag.colno);
  }

  const node = new ASTSet(tag.lineno, tag.colno, []);

  let target;
  while ((target = ctx.parsePrimary())) {
    node.targets.push(target);

    if (!skip(ctx, lexer.TOKEN_COMMA)) {
      break;
    }
  }

  if (!skipValue(ctx, lexer.TOKEN_OPERATOR, '=')) {
    const assignOps = ['||=', '&&=', '??='];
    let foundOp = null;

    for (const op of assignOps) {
      const tok = peekToken(ctx);
      if (tok && tok.type === lexer.TOKEN_OPERATOR && tok.value === op) {
        nextToken(ctx);
        foundOp = op;
        break;
      }
    }

    if (!foundOp) {
      if (!skip(ctx, lexer.TOKEN_BLOCK_END)) {
        fail(ctx, 'parseSet: expected =, ||= , &&=, ??= or block end in set tag',
          tag.lineno,
          tag.colno);
      } else {
        node.body = new Capture(
          tag.lineno,
          tag.colno,
          ctx.parseUntilBlocks('endset')
        );
        node.value = null;
        node.operator = null;
        advanceAfterBlockEnd(ctx);
      }
    } else {
      node.operator = foundOp;
      node.value = ctx.parseExpression();
      advanceAfterBlockEnd(ctx, tag.value);
    }
  } else {
    node.value = ctx.parseExpression();
    node.operator = null;
    advanceAfterBlockEnd(ctx, tag.value);
  }

  return node;
};

export const parseSwitch = (ctx) => {
  const switchStart = 'switch';
  const switchEnd = 'endswitch';
  const caseStart = 'case';
  const caseDefault = 'default';

  const tag = peekToken(ctx);

  if (
    !skipSymbol(ctx, switchStart)
    && !skipSymbol(ctx, caseStart)
    && !skipSymbol(ctx, caseDefault)
  ) {
    fail(ctx, 'parseSwitch: expected "switch," "case" or "default"', tag.lineno, tag.colno);
  }

  const expr = ctx.parseExpression();

  advanceAfterBlockEnd(ctx, switchStart);
  ctx.parseUntilBlocks(caseStart, caseDefault, switchEnd);

  let tok = peekToken(ctx);

  const cases = [];
  let defaultCase;

  do {
    skipSymbol(ctx, caseStart);
    const cond = ctx.parseExpression();
    advanceAfterBlockEnd(ctx, switchStart);
    const body = ctx.parseUntilBlocks(caseStart, caseDefault, switchEnd);
    cases.push(new Case(tok.line, tok.col, cond, body));
    tok = peekToken(ctx);
  } while (tok && tok.value === caseStart);

  switch (tok.value) {
    case caseDefault:
      advanceAfterBlockEnd(ctx);
      defaultCase = ctx.parseUntilBlocks(switchEnd);
      advanceAfterBlockEnd(ctx);
      break;
    case switchEnd:
      advanceAfterBlockEnd(ctx);
      break;
    default:
      fail(ctx, 'parseSwitch: expected "case," "default" or "endswitch," got EOF.');
  }

  return new Switch(tag.lineno, tag.colno, expr, cases, defaultCase);
};

export const parseRaw = (ctx, tagName) => {
  tagName = tagName || 'raw';
  const endTagName = 'end' + tagName;
  const rawBlockRegex = new RegExp('([\\s\\S]*?){%\\s*(' + tagName + '|' + endTagName + ')\\s*(?=%})%}');
  let rawLevel = 1;
  let str = '';
  let matches = null;

  const begun = advanceAfterBlockEnd(ctx);

  while ((matches = ctx.tokens._extractRegex(rawBlockRegex)) && rawLevel > 0) {
    const all = matches[0];
    const pre = matches[1];
    const blockName = matches[2];

    if (blockName === tagName) {
      rawLevel += 1;
    } else if (blockName === endTagName) {
      rawLevel -= 1;
    }

    if (rawLevel === 0) {
      str += pre;
      ctx.tokens.backN(all.length - pre.length);
    } else {
      str += all;
    }
  }

  return new Output(
    begun.lineno,
    begun.colno,
    [new TemplateData(begun.lineno, begun.colno, str)]
  );
};

export const parseFilterStatement = (ctx) => {
  const filterTok = peekToken(ctx);
  if (!skipSymbol(ctx, 'filter')) {
    fail(ctx, 'parseFilterStatement: expected filter');
  }

  const name = ctx.parseFilterName();
  const args = ctx.parseFilterArgs(name);

  advanceAfterBlockEnd(ctx, filterTok.value);
  const body = new Capture(
    name.lineno,
    name.colno,
    ctx.parseUntilBlocks('endfilter')
  );
  advanceAfterBlockEnd(ctx);

  const node = new nodes.Filter(
    name.lineno,
    name.colno,
    name,
    new NodeList(
      name.lineno,
      name.colno,
      [body].concat(args)
    )
  );

  return new Output(
    name.lineno,
    name.colno,
    [node]
  );
};

export const parseStatement = (ctx) => {
  const tok = peekToken(ctx);

  if (tok.type !== lexer.TOKEN_SYMBOL) {
    fail(ctx, 'tag name expected', tok.lineno, tok.colno);
  }

  if (ctx.breakOnBlocks &&
    (ctx.breakOnBlocks || []).indexOf(tok.value) !== -1) {
    return null;
  }

  switch (tok.value) {
    case 'raw':
      return parseRaw(ctx);
    case 'verbatim':
      return parseRaw(ctx, 'verbatim');
    case 'if':
    case 'ifAsync':
      return parseIf(ctx);
    case 'for':
    case 'asyncEach':
    case 'asyncAll':
      return parseFor(ctx);
    case 'block':
      return parseBlock(ctx);
    case 'extends':
      return parseExtends(ctx);
    case 'include':
      return parseInclude(ctx);
    case 'set':
      return parseSet(ctx);
    case 'macro':
      return parseMacro(ctx);
    case 'call':
      return parseCall(ctx);
    case 'import':
      return parseImport(ctx);
    case 'from':
      return parseFrom(ctx);
    case 'filter':
      return parseFilterStatement(ctx);
    case 'switch':
      return parseSwitch(ctx);
    default:
      if (ctx.extensions.length) {
        for (let i = 0; i < ctx.extensions.length; i++) {
          const ext = ctx.extensions[i];
          if ((ext.tags || []).indexOf(tok.value) !== -1) {
            return ext.parse(ctx, nodes, lexer);
          }
        }
      }
      fail(ctx, 'unknown block tag: ' + tok.value, tok.lineno, tok.colno);
  }
};
