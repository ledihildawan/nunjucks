
import { T } from '@nunjucks/nodes';
import type { Node, SymbolNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from './index.ts';
import {
  compileLiteral,
  compileSymbol,
  compileGroup,
  compileArray,
  compileDict,
  compileNodeList,
  compilePair,
  compileKeywordArgs,
  compileFunCall,
  compilePipeForward,
  compileLookupVal,
  compileOptionalChain,
  compileOptionalCall,
  compileSlice,
  compileCompare,
  compileIs,
  compileInlineIf,
  compileWalrus,
  compileOr,
  compileAnd,
  compileAdd,
  compileConcat,
  compileRange,
  compileSub,
  compileMul,
  compileDiv,
  compileMod,
  compileNullishCoalesce,
  compileIn,
  compileFloorDiv,
  compilePow,
  compileNot,
  compileNeg,
  compilePos,
  compileSpread,
  compileTemplateLiteral,
  compileBitwiseOr,
  compileBitwiseAnd,
  compileBitwiseXor,
  compileBitwiseLShift,
  compileBitwiseRShift,
  compileBitwiseNot,
  compileIncrement,
  compileDecrement,
  compileTest,
  compileTestCall,
} from './expression-compiler/index.ts';

import {
  compileIf,
  compileVariableDeclaration,
  compileVariableAssignment,
  compileCompoundAssignment,
  compileSwitch,
  compileFor,
  compileComponentPublic,
  compileBlock,
  compileSuper,
  compileImport,
  compileFromImport,
  compileExtends,
  compileInclude,
  compileTemplateData,
  compileCapture,
  compileOutput,
  compileRoot,
  compileCallExtension,
  compileCallExtensionAsync,
  compileExec,
  compileScope,
  compileMatch,
  compileWhen,
  compileRenderBlock,
} from './statement-compiler/index.ts';

export type CompileFn = (ctx: Compiler, node: Node, frame: Frame) => void;

export const compileDispatch = (ctx: Compiler, node: Node, frame: Frame): void => {
  switch (node.type) {
    case T.NODE:
    case T.VALUE:
    case T.LITERAL: { compileLiteral(ctx, node); return; }
    case T.SYMBOL: { compileSymbol(ctx, node as SymbolNode, frame); return; }
    case T.GROUP: { compileGroup(ctx, node, frame); return; }
    case T.ARRAY: { compileArray(ctx, node, frame); return; }
    case T.DICT: { compileDict(ctx, node, frame); return; }
    case T.NODE_LIST: { compileNodeList(ctx, node, frame); return; }
    case T.PAIR: { compilePair(ctx, node, frame); return; }
    case T.KEYWORD_ARGS: { compileKeywordArgs(ctx, node, frame); return; }
    case T.FUN_CALL: { compileFunCall(ctx, node, frame); return; }
    case T.PIPE: { compilePipeForward(ctx, node, frame); return; }
    case T.LOOKUP_VAL: { compileLookupVal(ctx, node, frame); return; }
    case T.OPTIONAL_CHAIN: { compileOptionalChain(ctx, node, frame); return; }
    case T.OPTIONAL_CALL: { compileOptionalCall(ctx, node, frame); return; }
    case T.SLICE: { compileSlice(ctx, node, frame); return; }
    case T.COMPARE: { compileCompare(ctx, node, frame); return; }
    case T.IS: { compileIs(ctx, node, frame); return; }
    case T.TEST: { compileTest(ctx, node, frame); return; }
    case T.TEST_CALL: { compileTestCall(ctx, node, frame); return; }
    case T.INLINE_IF: { compileInlineIf(ctx, node, frame); return; }
    case T.WALRUS: { compileWalrus(ctx, node, frame); return; }
    case T.OR: { compileOr(ctx, node, frame); return; }
    case T.AND: { compileAnd(ctx, node, frame); return; }
    case T.ADD: { compileAdd(ctx, node, frame); return; }
    case T.CONCAT: { compileConcat(ctx, node, frame); return; }
    case T.RANGE: { compileRange(ctx, node, frame); return; }
    case T.SUB: { compileSub(ctx, node, frame); return; }
    case T.MUL: { compileMul(ctx, node, frame); return; }
    case T.DIV: { compileDiv(ctx, node, frame); return; }
    case T.MOD: { compileMod(ctx, node, frame); return; }
    case T.NULLISH_COALESCE: { compileNullishCoalesce(ctx, node, frame); return; }
    case T.IN: { compileIn(ctx, node, frame); return; }
    case T.FLOOR_DIV: { compileFloorDiv(ctx, node, frame); return; }
    case T.POW: { compilePow(ctx, node, frame); return; }
    case T.NOT: { compileNot(ctx, node, frame); return; }
    case T.NEG: { compileNeg(ctx, node, frame); return; }
    case T.POS: { compilePos(ctx, node, frame); return; }
    case T.SPREAD: { compileSpread(ctx, node, frame); return; }
    case T.TEMPLATE_LITERAL: { compileTemplateLiteral(ctx, node, frame); return; }
    case T.BITWISE_OR: { compileBitwiseOr(ctx, node, frame); return; }
    case T.BITWISE_AND: { compileBitwiseAnd(ctx, node, frame); return; }
    case T.BITWISE_XOR: { compileBitwiseXor(ctx, node, frame); return; }
    case T.BITWISE_LSHIFT: { compileBitwiseLShift(ctx, node, frame); return; }
    case T.BITWISE_RSHIFT: { compileBitwiseRShift(ctx, node, frame); return; }
    case T.BITWISE_NOT: { compileBitwiseNot(ctx, node, frame); return; }
    case T.INCREMENT: { compileIncrement(ctx, node, frame); return; }
    case T.DECREMENT: { compileDecrement(ctx, node, frame); return; }
    case T.VARIABLE_DECLARATION: { compileVariableDeclaration(ctx, node, frame); return; }
    case T.VARIABLE_ASSIGNMENT: { compileVariableAssignment(ctx, node, frame); return; }
    case T.COMPOUND_ASSIGNMENT: { compileCompoundAssignment(ctx, node, frame); return; }
    case T.SWITCH: { compileSwitch(ctx, node, frame); return; }
    case T.IF: { compileIf(ctx, node, frame); return; }
    case T.FOR: { compileFor(ctx, node, frame); return; }
    case T.COMPONENT: { compileComponentPublic(ctx, node, frame); return; }
    case T.IMPORT: { compileImport(ctx, node, frame); return; }
    case T.FROM_IMPORT: { compileFromImport(ctx, node, frame); return; }
    case T.BLOCK: { compileBlock(ctx, node); return; }
    case T.SUPER: { compileSuper(ctx, node, frame); return; }
    case T.EXTENDS: { compileExtends(ctx, node, frame); return; }
    case T.INCLUDE: { compileInclude(ctx, node, frame); return; }
    case T.TEMPLATE_DATA: { compileTemplateData(ctx, node, frame); return; }
    case T.CAPTURE: { compileCapture(ctx, node, frame); return; }
    case T.OUTPUT: { compileOutput(ctx, node, frame); return; }
    case T.CALL_EXTENSION: { compileCallExtension(ctx, node, frame); return; }
    case T.CALL_EXTENSION_ASYNC: { compileCallExtensionAsync(ctx, node, frame); return; }
    case T.ROOT: { compileRoot(ctx, node); return; }
    case T.EXEC: { compileExec(ctx, node, frame); return; }
    case T.SCOPE: { compileScope(ctx, node, frame); return; }
    case T.MATCH: { compileMatch(ctx, node, frame); return; }
    case T.WHEN: { compileWhen(ctx, node, frame); return; }
    case T.RENDER: { compileRenderBlock(ctx, node, frame); return; }
    default:
      ctx.fail(`compile: Cannot compile node: ${node.type}`, node.lineno, node.colno);
  }
};
