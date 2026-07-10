'use strict';

import { configure, render, renderString } from '../../../nunjucks/index.js';

configure('views', {
  autoescape: true,
  ide: 'vscode'
});

export { configure, render, renderString };
