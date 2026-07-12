import express from 'express';
import { createContainer } from '../../../src/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIEWS = path.join(__dirname, '..', 'views');

const c = createContainer();

const envDev = c.environment(c.loader.fileSystem(VIEWS), {
  autoescape: true,
  dev: true,
  ide: 'vscode',
  undefined: 'strict'
});

const envSandbox = c.environment(c.loader.fileSystem(VIEWS), {
  autoescape: true,
  dev: true,
  ide: 'vscode',
  sandbox: true
});

envDev.addFilter('failingAsync', async function(val) {
  throw new Error('Async filter failed: network error');
}, true);

envDev.addFilter('throwingFilter', function(val) {
  throw new Error('Filter intentionally threw an error');
});

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
  { path: '/undefined-variable', template: 'error-undefined-variable.njk', category: 'undefined_variable', desc: 'Variable not passed in context', context: { user: complexUserContext.user } },
  { path: '/undefined-function', template: 'error-undefined-function.njk', category: 'undefined_function', desc: 'Function not registered with addGlobal()', context: complexUserContext },
  { path: '/not-a-function', template: 'error-not-a-function.njk', category: 'not_a_function', desc: 'Calling a non-function value', context: { user: { name: 'Alice', status: 'active' } } },
  { path: '/undefined-filter', template: 'error-undefined-filter.njk', category: 'undefined_filter', desc: 'Filter not registered with addFilter()', context: complexUserContext },
  { path: '/filter-error', template: 'error-filter-error.njk', category: 'filter_error', desc: 'Filter throws during execution', context: { value: 42, data: complexUserContext } },
  { path: '/undefined-value', template: 'error-undefined-value.njk', category: 'undefined_value', desc: 'Nested property access returns null/undefined', context: { product: null } },
  { path: '/undefined-block', template: 'error-undefined-block.njk', category: 'undefined_block', desc: 'Block defined in child but not in parent' },
  { path: '/syntax-error', template: 'error-syntax-error.njk', category: 'syntax_error', desc: 'Template syntax is invalid' },
  { path: '/no-super-block', template: 'error-no-super-block.njk', category: 'no_super_block', desc: 'super() called but no parent block' },
  { path: '/invalid-include', template: 'error-invalid-include.njk', category: 'invalid_include', desc: 'Include path is not a string' },
  { path: '/circular-include', template: 'error-circular-include.njk', category: 'circular_include', desc: 'Template includes itself' },
  { path: '/file-not-found', template: 'error-file-not-found.njk', category: 'file_not_found', desc: 'Template file does not exist' },
  { path: '/filesystem-error', template: 'error-filesystem-error.njk', category: 'filesystem_error', desc: 'Loader search path does not exist' },
  { path: '/invalid-lookup', template: 'error-invalid-lookup.njk', category: 'invalid_lookup', desc: 'Invalid bracket notation after dot' },
  { path: '/duplicate-block', template: 'error-duplicate-block.njk', category: 'duplicate_block', desc: 'Duplicate block definition' },
  { path: '/unknown-block-tag', template: 'error-unknown-block-tag.njk', category: 'unknown_block_tag', desc: 'Unmatched closing tag' },
];

const router = express.Router();

errorRoutes.forEach(({ path: routePath, template, category, desc, context }) => {
  router.get(routePath, async (req, res) => {
    try {
      const html = await envDev.render(template, context || {});
      res.type('html').send(html);
    } catch (e) {
      res.status(500).type('html').send(e.toHtmlString());
    }
  });
});

router.get('/inline-error', async (req, res) => {
  try {
    const html = await envDev.render('{{ undefinedVar }}', {});
    res.type('html').send(html);
  } catch (e) {
    res.status(500).type('html').send(e.toHtmlString());
  }
});

router.get('/filesystem-error', async (req, res) => {
  const c2 = createContainer();
  const envFsError = c2.environment(c2.loader.fileSystem('/nonexistent/path/that/does/not/exist'), {
    autoescape: true,
    dev: true,
    ide: 'vscode',
    undefined: 'strict'
  });
  try {
    await envFsError.render('test.html', {});
  } catch (e) {
    res.status(500).type('html').send(e.toHtmlString());
  }
});

router.get('/sandbox-proto', async (req, res) => {
  try {
    const html = await envSandbox.render('{{ user.__proto__ }}', { user: {} });
    res.type('html').send(html);
  } catch (e) {
    res.status(500).type('html').send(e.toHtmlString());
  }
});

router.get('/sandbox-constructor', async (req, res) => {
  try {
    const html = await envSandbox.render('{{ user.constructor }}', { user: {} });
    res.type('html').send(html);
  } catch (e) {
    res.status(500).type('html').send(e.toHtmlString());
  }
});

router.get('/sandbox-process', async (req, res) => {
  try {
    const html = await envSandbox.render('{{ user.global }}', { user: { global: process } });
    res.type('html').send(html);
  } catch (e) {
    res.status(500).type('html').send(e.toHtmlString());
  }
});

router.get('/slice-error', async (req, res) => {
  try {
    const html = await envDev.render('{{ [1,2,3][::0] }}', {});
    res.type('html').send(html);
  } catch (e) {
    res.status(500).type('html').send(e.toHtmlString());
  }
});

router.get('/list-filter-error', async (req, res) => {
  try {
    const html = await envDev.render('{{ 42 |> list }}', {});
    res.type('html').send(html);
  } catch (e) {
    res.status(500).type('html').send(e.toHtmlString());
  }
});

router.get('/in-operator-error', async (req, res) => {
  try {
    const html = await envDev.render('{{ key in value }}', { key: 'test', value: 123 });
    res.type('html').send(html);
  } catch (e) {
    res.status(500).type('html').send(e.toHtmlString());
  }
});

router.get('/filter-throw', async (req, res) => {
  try {
    const html = await envDev.render('{{ "test" |> throwingFilter }}', {});
    res.type('html').send(html);
  } catch (e) {
    res.status(500).type('html').send(e.toHtmlString());
  }
});

export { router as errorRouter, errorRoutes };
