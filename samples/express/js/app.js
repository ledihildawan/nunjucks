import nunjucks from '../../../src/index.js';

const configure = (options = {}) => {
  nunjucks.configure(options);
  return {
    render: (template, context) => nunjucks.render(template, context)
  };
};

const render = (template, context) => nunjucks.render(template, context);

export { configure, render };
