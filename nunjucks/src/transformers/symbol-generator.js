import * as nodeTypes from '../nodes.js';
import {
  Node,
  NodeList,
  Block,
  FunCall,
  Symbol as ASTSymbol,
  Super,
  Pipe,
  PipeAsync,
  CallExtension,
  CallExtensionAsync,
  Output,
  Set as ASTSet,
  For,
  If,
  IfAsync,
  AsyncEach,
  AsyncAll,
} from '../nodes.js';

export const createSymbolGenerator = (seed = 0) => {
  let counter = seed;
  return () => {
    const value = `hole_${counter++}`;
    return value;
  };
};

export const createGensym = () => {
  const gen = createSymbolGenerator(0);
  return () => gen();
};
