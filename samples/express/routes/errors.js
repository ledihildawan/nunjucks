import express from 'express';
import nunjucks from '../../../nunjucks/index.js';
import { createErrorFormatter } from '../../../nunjucks/src/error/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIEWS = path.join(__dirname, '..', 'views');
const fsLoader = new nunjucks.FileSystemLoader(VIEWS);
const router = express.Router();

const envDev = new nunjucks.Environment(fsLoader, {
  autoescape: true,
  dev: true,
  throwOnUndefined: true
});

envDev.addFilter('failingAsync', async function(val) {
  throw new Error('Async filter failed: network error');
}, true);

const errorFormatter = createErrorFormatter();

async function renderWithErrorHandler(res, templateName, context = {}) {
  try {
    const html = await envDev.render(templateName, context);
    res.type('html').send(html);
  } catch (e) {
    const formatted = await errorFormatter.formatError(e, templateName, e._includeChain, path.join(VIEWS, templateName), context);
    const code = formatted.code || formatted.classified?.category || 'unknown';
    if (formatted.errorId) {
      res.setHeader('X-Error-Id', formatted.errorId);
    }
    console.error(`[${code}]${formatted.errorId ? ` [${formatted.errorId}]` : ''}`, formatted.toConsoleString());
    res.type('html').status(500).send(formatted.toHtmlString());
  }
}

const errorRoutes = [
  { path: '/undefined-variable', template: 'error-undefined-variable.html', category: 'undefined_variable', desc: 'Variable not passed in context', context: { user: 'Alice', role: 'admin' } },
  { path: '/undefined-function', template: 'error-undefined-function.html', category: 'undefined_function', desc: 'Function not registered with addGlobal()', context: { user: 'Alice' } },
  { path: '/not-a-function', template: 'error-not-a-function.html', category: 'not_a_function', desc: 'Calling a non-function value', context: { foo: 'I am a string' } },
  { path: '/undefined-filter', template: 'error-undefined-filter.html', category: 'undefined_filter', desc: 'Filter not registered with addFilter()', context: { product: 'Widget' } },
  { path: '/filter-error', template: 'error-filter-error.html', category: 'filter_error', desc: 'Filter throws during execution', context: { value: 42 } },
  { path: '/undefined-value', template: 'error-undefined-value.html', category: 'undefined_value', desc: 'Nested property access returns null/undefined', context: { foo: {} } },
  { path: '/syntax-error', template: 'error-syntax-error.html', category: 'syntax_error', desc: 'Template syntax is invalid' },
  { path: '/no-super-block', template: 'error-no-super-block.html', category: 'no_super_block', desc: 'super() called but no parent block' },
  { path: '/invalid-include', template: 'error-invalid-include.html', category: 'invalid_include', desc: 'Include path is not a string' },
  { path: '/circular-include', template: 'error-circular-include.html', category: 'circular_include', desc: 'Template includes itself' },
  { path: '/file-not-found', template: 'error-file-not-found.html', category: 'file_not_found', desc: 'Template file does not exist' },
];

errorRoutes.forEach(({ path: routePath, template, category, desc, context }) => {
  router.get(routePath, async (req, res) => {
    await renderWithErrorHandler(res, template, context || {});
  });
});

export { router as errorRouter, errorRoutes };