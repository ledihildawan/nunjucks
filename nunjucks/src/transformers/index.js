import { liftPipes } from './pipe-transforms.js';
import { liftSuper } from './super-transforms.js';
import { convertStatements } from './statement-transforms.js';

const cps = (ast, asyncPipes) => {
  return convertStatements(liftSuper(liftPipes(ast, asyncPipes)));
};

const transform = (ast, asyncPipes) => {
  return cps(ast, asyncPipes || []);
};

export { cps, transform };
export { createSymbolGenerator, createGensym } from './symbol-generator.js';
export { liftPipes } from './pipe-transforms.js';
export { liftSuper } from './super-transforms.js';
export { convertStatements } from './statement-transforms.js';
export { walk, depthWalk, mapCOW } from './walk.js';
