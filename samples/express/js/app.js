import { createContainer } from '../../../src/index.js';

const c = createContainer();

const configure = (views, options) => {
  return c.environment(c.loader.fileSystem(views), options);
};

const render = (name, context) => c.environment().render(name, context);
const renderString = (str, context) => c.environment().renderString(str, context);

export { configure, render, renderString };
