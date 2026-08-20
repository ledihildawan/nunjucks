import type { Node, NodeType, SymbolNode } from '@nunjucks/nodes';
import { T } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from './create-compiler.ts';
import {
  compileAdd,
  compileAnd,
  compileArray,
  compileBitwiseAnd,
  compileBitwiseLShift,
  compileBitwiseNot,
  compileBitwiseOr,
  compileBitwiseRShift,
  compileBitwiseXor,
  compileCompare,
  compileConcat,
  compileDecrement,
  compileDict,
  compileDiv,
  compileFloorDiv,
  compileFunCall,
  compileGroup,
  compileIn,
  compileIncrement,
  compileInlineIf,
  compileIs,
  compileKeywordArgs,
  compileLiteral,
  compileLookupVal,
  compileMod,
  compileMul,
  compileNeg,
  compileNodeList,
  compileNot,
  compileNullishCoalesce,
  compileOptionalCall,
  compileOptionalChain,
  compileOr,
  compilePair,
  compilePipeForward,
  compilePos,
  compilePow,
  compileRange,
  compileSpread,
  compileSub,
  compileSymbol,
  compileTemplateLiteral,
  compileTest,
  compileTestCall,
  compileWalrus,
} from './expression-compiler/index.ts';

import {
  compileBlock,
  compileCallExtension,
  compileCallExtensionAsync,
  compileCapture,
  compileComponentPublic,
  compileCompoundAssignment,
  compileExec,
  compileExtends,
  compileFor,
  compileFromImport,
  compileIf,
  compileImport,
  compileInclude,
  compileMatch,
  compileOutput,
  compileRenderBlock,
  compileRoot,
  compileScope,
  compileSuper,
  compileSwitch,
  compileTemplateData,
  compileVariableAssignment,
  compileVariableDeclaration,
  compileWhen,
} from './statement-compiler/index.ts';

/** The compiler-facing input passed to every node-compile function. */
export interface CompileNodeInput<N extends Node = Node> {
  node: N;
  frame: Frame;
}

type CompileFn<N extends Node = Node> = (compiler: Compiler, input: CompileNodeInput<N>) => void;

const noFrame =
  <N extends Node = Node>(compile: (compiler: Compiler, node: N) => void): CompileFn =>
  (compiler, { node }) =>
    compile(compiler, node as N);

const withFrame =
  <N extends Node>(compile: (compiler: Compiler, input: CompileNodeInput<N>) => void): CompileFn =>
  (compiler, input) =>
    compile(compiler, { node: input.node as N, frame: input.frame });

// WHY: the T-key → compiler correlation is an internal table invariant TS cannot
// enforce generically; the noFrame/withFrame casts restore the per-entry node type.
const NODE_COMPILERS: Readonly<Partial<Record<NodeType, CompileFn>>> = {
  [T.LITERAL]: noFrame(compileLiteral),
  [T.SYMBOL]: withFrame<SymbolNode>(compileSymbol),
  [T.GROUP]: withFrame(compileGroup),
  [T.ARRAY]: withFrame(compileArray),
  [T.DICT]: withFrame(compileDict),
  [T.NODE_LIST]: withFrame(compileNodeList),
  [T.PAIR]: withFrame(compilePair),
  [T.KEYWORD_ARGS]: withFrame(compileKeywordArgs),
  [T.FUN_CALL]: withFrame(compileFunCall),
  [T.PIPE]: withFrame(compilePipeForward),
  [T.LOOKUP_VAL]: withFrame(compileLookupVal),
  [T.OPTIONAL_CHAIN]: withFrame(compileOptionalChain),
  [T.OPTIONAL_CALL]: withFrame(compileOptionalCall),
  // WHY: T.SLICE deliberately has no entry — a standalone SliceNode has no source
  // operand (the parser only produces slices as a LookupNode.val, compiled there);
  // hand-built standalone slices fail closed through the unknown-type path below.
  [T.COMPARE]: withFrame(compileCompare),
  [T.IS]: withFrame(compileIs),
  [T.TEST]: withFrame(compileTest),
  [T.TEST_CALL]: withFrame(compileTestCall),
  [T.INLINE_IF]: withFrame(compileInlineIf),
  [T.WALRUS]: withFrame(compileWalrus),
  [T.OR]: withFrame(compileOr),
  [T.AND]: withFrame(compileAnd),
  [T.ADD]: withFrame(compileAdd),
  [T.CONCAT]: withFrame(compileConcat),
  [T.RANGE]: withFrame(compileRange),
  [T.SUB]: withFrame(compileSub),
  [T.MUL]: withFrame(compileMul),
  [T.DIV]: withFrame(compileDiv),
  [T.MOD]: withFrame(compileMod),
  [T.NULLISH_COALESCE]: withFrame(compileNullishCoalesce),
  [T.IN]: withFrame(compileIn),
  [T.FLOOR_DIV]: withFrame(compileFloorDiv),
  [T.POW]: withFrame(compilePow),
  [T.NOT]: withFrame(compileNot),
  [T.NEG]: withFrame(compileNeg),
  [T.POS]: withFrame(compilePos),
  [T.SPREAD]: withFrame(compileSpread),
  [T.TEMPLATE_LITERAL]: withFrame(compileTemplateLiteral),
  [T.BITWISE_OR]: withFrame(compileBitwiseOr),
  [T.BITWISE_AND]: withFrame(compileBitwiseAnd),
  [T.BITWISE_XOR]: withFrame(compileBitwiseXor),
  [T.BITWISE_LSHIFT]: withFrame(compileBitwiseLShift),
  [T.BITWISE_RSHIFT]: withFrame(compileBitwiseRShift),
  [T.BITWISE_NOT]: withFrame(compileBitwiseNot),
  [T.INCREMENT]: withFrame(compileIncrement),
  [T.DECREMENT]: withFrame(compileDecrement),
  [T.VARIABLE_DECLARATION]: withFrame(compileVariableDeclaration),
  [T.VARIABLE_ASSIGNMENT]: withFrame(compileVariableAssignment),
  [T.COMPOUND_ASSIGNMENT]: withFrame(compileCompoundAssignment),
  [T.SWITCH]: withFrame(compileSwitch),
  [T.IF]: withFrame(compileIf),
  [T.FOR]: withFrame(compileFor),
  [T.COMPONENT]: withFrame(compileComponentPublic),
  [T.IMPORT]: withFrame(compileImport),
  [T.FROM_IMPORT]: withFrame(compileFromImport),
  [T.BLOCK]: noFrame(compileBlock),
  [T.SUPER]: withFrame(compileSuper),
  [T.EXTENDS]: withFrame(compileExtends),
  [T.INCLUDE]: withFrame(compileInclude),
  [T.TEMPLATE_DATA]: withFrame(compileTemplateData),
  [T.CAPTURE]: withFrame(compileCapture),
  [T.OUTPUT]: withFrame(compileOutput),
  [T.CALL_EXTENSION]: withFrame(compileCallExtension),
  [T.CALL_EXTENSION_ASYNC]: withFrame(compileCallExtensionAsync),
  [T.ROOT]: noFrame(compileRoot),
  [T.EXEC]: withFrame(compileExec),
  [T.SCOPE]: withFrame(compileScope),
  [T.MATCH]: withFrame(compileMatch),
  [T.WHEN]: withFrame(compileWhen),
  [T.RENDER]: withFrame(compileRenderBlock),
};

/**
 * Dispatches `input.node` to its registered compile function, failing closed
 * through `compiler.fail` for types with no registry entry.
 */
export const compileDispatch = (compiler: Compiler, input: CompileNodeInput): void => {
  const compile = NODE_COMPILERS[input.node.type];
  if (compile) {
    compile(compiler, input);
    return;
  }
  compiler.fail({
    message: `compile: Cannot compile node: ${input.node.type}`,
    lineno: input.node.lineno,
    colno: input.node.colno,
  });
};
