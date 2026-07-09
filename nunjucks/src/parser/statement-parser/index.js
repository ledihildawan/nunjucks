import * as lexer from '../../lexer/index.js';
import * as nodes from '../../nodes.js';
import { peekToken, fail } from '../cursor.js';
import { parseFor } from './for.js';
import { parseMacro } from './macro.js';
import { parseCall } from './call.js';
import { parseImport } from './import.js';
import { parseFrom } from './from.js';
import { parseBlock } from './block.js';
import { parseExtends } from './extends.js';
import { parseInclude } from './include.js';
import { parseIf } from './if.js';
import { parseSet } from './set.js';
import { parseSwitch } from './switch.js';
import { parseRaw } from './raw.js';
import { parseFilterStatement } from './filter.js';

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
