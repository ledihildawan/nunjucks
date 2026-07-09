import { liftPipes } from './pipe-transforms.js';
import { liftSuper } from './super-transforms.js';
import { convertStatements } from './statement-transforms.js';

export const cps = (ast, asyncPipes) => {
  return convertStatements(liftSuper(liftPipes(ast, asyncPipes)));
};

export const transform = (ast, asyncPipes) => {
  return cps(ast, asyncPipes || []);
};
