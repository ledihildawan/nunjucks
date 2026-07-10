import express from 'express';
import { configure } from '../../../nunjucks/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIEWS = path.join(__dirname, '..', 'views');

const envDev = configure(VIEWS, {
  autoescape: true,
  dev: true,
  ide: 'vscode',
  throwOnUndefined: true
});

envDev.addFilter('failingAsync', async function(val) {
  throw new Error('Async filter failed: network error');
}, true);

async function renderWithErrorHandler(res, templateName, context = {}, reqHeaders = {}) {
  try {
    const html = await envDev.render(templateName, context);
    res.type('html').send(html);
  } catch (e) {
    const err = await envDev.formatError(e, templateName, {
      templatePath: path.join(VIEWS, templateName),
      renderContext: context,
      requestHeaders: reqHeaders
    });

    if (err.csp?.nonce) {
      res.setHeader('Content-Security-Policy', `script-src 'self' 'nonce-${err.csp.nonce}'; style-src 'self' 'nonce-${err.csp.nonce}'`);
    }

    console.error(err.toConsoleString());
    res.type('html').status(500).send(err.toHtmlString());
  }
}

const complexUserContext = {
  user: {
    id: 'usr_8a9b2c3d4e5f',
    username: 'alice_dev',
    email: 'alice@example.com',
    profile: {
      firstName: 'Alice',
      lastName: 'Johnson',
      avatar: 'https://example.com/avatars/alice.jpg',
      bio: 'Full-stack developer & open source enthusiast',
      settings: {
        theme: 'dark',
        notifications: true,
        language: 'en-US'
      }
    },
    metadata: {
      createdAt: '2024-01-15T08:30:00Z',
      lastLogin: '2026-07-09T14:22:00Z',
      permissions: ['read', 'write', 'admin'],
      tags: ['vip', 'beta-tester']
    }
  },
  role: 'admin',
  cart: {
    items: [
      { id: 'item_001', name: 'Wireless Keyboard', price: 79.99, quantity: 1 },
      { id: 'item_002', name: 'USB-C Hub', price: 49.99, quantity: 2 }
    ],
    total: 179.97,
    currency: 'USD',
    couponCode: null
  },
  preferences: {
    currency: 'USD',
    locale: 'en-US',
    timezone: 'America/New_York'
  }
};

const errorRoutes = [
  { path: '/undefined-variable', template: 'error-undefined-variable.html', category: 'undefined_variable', desc: 'Variable not passed in context', context: complexUserContext },
  { path: '/undefined-function', template: 'error-undefined-function.html', category: 'undefined_function', desc: 'Function not registered with addGlobal()', context: complexUserContext },
  { path: '/not-a-function', template: 'error-not-a-function.html', category: 'not_a_function', desc: 'Calling a non-function value', context: complexUserContext },
  { path: '/undefined-filter', template: 'error-undefined-filter.html', category: 'undefined_filter', desc: 'Filter not registered with addFilter()', context: complexUserContext },
  { path: '/filter-error', template: 'error-filter-error.html', category: 'filter_error', desc: 'Filter throws during execution', context: { value: 42, data: complexUserContext } },
  { path: '/undefined-value', template: 'error-undefined-value.html', category: 'undefined_value', desc: 'Nested property access returns null/undefined', context: complexUserContext },
  { path: '/syntax-error', template: 'error-syntax-error.html', category: 'syntax_error', desc: 'Template syntax is invalid' },
  { path: '/no-super-block', template: 'error-no-super-block.html', category: 'no_super_block', desc: 'super() called but no parent block' },
  { path: '/invalid-include', template: 'error-invalid-include.html', category: 'invalid_include', desc: 'Include path is not a string' },
  { path: '/circular-include', template: 'error-circular-include.html', category: 'circular_include', desc: 'Template includes itself' },
  { path: '/file-not-found', template: 'error-file-not-found.html', category: 'file_not_found', desc: 'Template file does not exist' },
];

const router = express.Router();

errorRoutes.forEach(({ path: routePath, template, category, desc, context }) => {
  router.get(routePath, async (req, res) => {
    await renderWithErrorHandler(res, template, context || {}, req.headers);
  });
});

export { router as errorRouter, errorRoutes };
