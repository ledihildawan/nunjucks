'use strict';

import nunjucks from '../../../nunjucks/index.js';

nunjucks.configure('views', {
  autoescape: true,
  ide: 'vscode'
});

export default nunjucks;
