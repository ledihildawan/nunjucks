import { createContainer as createBaseContainer } from './shared/container.js';

import { createEnvironment, createSandboxedEnvironment } from './environment/index.js';
import { createTemplate } from './template/index.js';
import { createContext } from './runtime/context.js';
import { createFrame } from './runtime/frame.js';
import { createSandboxedContext } from './runtime/sandbox.js';
import { createFileSystemLoader } from './loaders/file-system.js';
import { createWebLoader } from './loaders/web.js';
import { createNodeResolveLoader } from './loaders/node-resolve.js';
import { createErrorFormatter } from './error/environment.js';
import { createCompiler } from './compiler/index.js';
import { createParser } from './parser/index.js';
import { createTokenizer } from './lexer/tokenizer.js';

export const createContainer = () => {
  const container = createBaseContainer();

  container.register('environment', createEnvironment);
  container.register('sandbox.environment', createSandboxedEnvironment);
  container.register('template', createTemplate);
  container.register('context', createContext);
  container.register('frame', createFrame);
  container.register('sandbox.context', createSandboxedContext);
  container.register('loader.fileSystem', createFileSystemLoader);
  container.register('loader.web', createWebLoader);
  container.register('loader.nodeResolve', createNodeResolveLoader);
  container.register('compiler', createCompiler);
  container.register('parser', createParser);
  container.register('tokenizer', createTokenizer);
  container.register('errorFormatter', createErrorFormatter);

  return container;
};
