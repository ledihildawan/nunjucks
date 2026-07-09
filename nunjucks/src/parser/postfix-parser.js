import * as lexer from '../lexer/index.js';
import {
  FunCall,
  LookupVal,
  Slice,
  OptionalChain,
  Literal,
} from '../nodes.js';
import { nextToken, peekToken, skip, expect, fail } from './cursor.js';

export const parsePostfix = (ctx, node) => {
  let lookup;
  let tok = peekToken(ctx);

  while (tok) {
    if (tok.type === lexer.TOKEN_LEFT_PAREN) {
      // Function call
      node = new FunCall(tok.lineno,
        tok.colno,
        node,
        ctx.parseSignature());
    } else if (tok.type === lexer.TOKEN_LEFT_BRACKET) {
      // Bracket access - could be slice or index
      const bracketTok = nextToken(ctx); // consume '['

      // Check if this is a slice starting with ':'
      if (skip(ctx, lexer.TOKEN_COLON)) {
        // Slice starting with colon [:stop:step] or [::step]
        let stop = null;
        let step = null;

        // Parse stop
        if (peekToken(ctx) && peekToken(ctx).type !== lexer.TOKEN_RIGHT_BRACKET &&
            peekToken(ctx).type !== lexer.TOKEN_COLON) {
          stop = ctx.parseExpression();
        }

        // Parse step
        if (skip(ctx, lexer.TOKEN_COLON)) {
          if (peekToken(ctx) && peekToken(ctx).type !== lexer.TOKEN_RIGHT_BRACKET) {
            step = ctx.parseExpression();
          }
        }

        expect(ctx, lexer.TOKEN_RIGHT_BRACKET);
        const sliceTok = peekToken(ctx);
        const slice = new Slice(sliceTok.lineno, sliceTok.colno, null, stop, step);
        node = new LookupVal(bracketTok.lineno, bracketTok.colno, node, slice);
      } else {
        // Parse first expression - could be start (for slice) or index
        const start = ctx.parseExpression();

        // Check if colon follows (slice) or right bracket (index)
        if (skip(ctx, lexer.TOKEN_COLON)) {
          // It's a slice [start:stop:step]
          let stop = null;
          let step = null;

          // Parse stop
          if (peekToken(ctx) && peekToken(ctx).type !== lexer.TOKEN_RIGHT_BRACKET &&
              peekToken(ctx).type !== lexer.TOKEN_COLON) {
            stop = ctx.parseExpression();
          }

          // Parse step
          if (skip(ctx, lexer.TOKEN_COLON)) {
            if (peekToken(ctx) && peekToken(ctx).type !== lexer.TOKEN_RIGHT_BRACKET) {
              step = ctx.parseExpression();
            }
          }

          expect(ctx, lexer.TOKEN_RIGHT_BRACKET);
          const sliceTok = peekToken(ctx);
          const slice = new Slice(sliceTok.lineno, sliceTok.colno, start, stop, step);
          node = new LookupVal(bracketTok.lineno, bracketTok.colno, node, slice);
        } else {
          // Simple index like [1] or [foo.bar] or [foo["bar"]]
          expect(ctx, lexer.TOKEN_RIGHT_BRACKET);
          node = new LookupVal(bracketTok.lineno, bracketTok.colno, node, start);
        }
      }
    } else if (tok.type === lexer.TOKEN_OPERATOR && tok.value === '.') {
      // Reference
      nextToken(ctx);
      const val = nextToken(ctx);

      if (val.type !== lexer.TOKEN_SYMBOL) {
        fail(ctx, 'expected name as lookup value, got ' + val.value,
          val.lineno,
          val.colno);
      }

      // Make a literal string because it's not a variable
      // reference
      lookup = new Literal(val.lineno,
        val.colno,
        val.value);

      node = new LookupVal(tok.lineno,
        tok.colno,
        node,
        lookup);
    } else if (tok.type === lexer.TOKEN_OPERATOR && tok.value === '?.') {
      // Optional chaining: foo?.bar
      nextToken(ctx);
      const val = nextToken(ctx);

      if (val.type !== lexer.TOKEN_SYMBOL) {
        fail(ctx, 'expected name as lookup value, got ' + val.value,
          val.lineno,
          val.colno);
      }

      lookup = new Literal(val.lineno,
        val.colno,
        val.value);

      node = new OptionalChain(tok.lineno,
        tok.colno,
        node,
        lookup);
    } else {
      break;
    }

    tok = peekToken(ctx);
  }

  return node;
};
