import {
  Node,
  NodeList,
  Block,
  FunCall,
  AstSymbol,
  Super,
  Pipe,
  PipeAsync,
  CallExtension,
  CallExtensionAsync,
  Output,
  Set,
  For,
  If,
  IfAsync,
  AsyncEach,
  AsyncAll,
} from '../nodes/index.js';

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
