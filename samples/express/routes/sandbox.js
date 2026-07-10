import express from 'express';
import { createSandboxedEnvironment, createEnvironment } from '../../../nunjucks/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIEWS = path.join(__dirname, '..', 'views');

const sandboxEnv = createSandboxedEnvironment(VIEWS, {
  autoescape: true,
  dev: true,
  ide: 'vscode'
});

const normalEnv = createEnvironment(VIEWS, {
  autoescape: true,
  dev: true,
  ide: 'vscode'
});

const router = express.Router();

router.get('/', async (req, res) => {
  res.type('html').send(`
<!DOCTYPE html>
<html>
<head>
  <title>Sandbox Demo</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { color: #2c3e50; }
    h2 { color: #3498db; border-bottom: 2px solid #3498db; padding-bottom: 8px; }
    .test-case { background: #f8f9fa; padding: 15px; margin: 15px 0; border-radius: 8px; }
    .success { border-left: 4px solid #27ae60; }
    .error { border-left: 4px solid #e74c3c; }
    code { background: #e9ecef; padding: 2px 6px; border-radius: 4px; }
    pre { background: #2c3e50; color: #ecf0f1; padding: 15px; border-radius: 8px; overflow-x: auto; }
    .nav { margin: 20px 0; }
    .nav a { display: inline-block; padding: 10px 15px; background: #3498db; color: white; border-radius: 5px; margin-right: 10px; text-decoration: none; }
    .nav a:hover { background: #2980b9; }
  </style>
</head>
<body>
  <h1>🔒 Sandbox Mode Demo</h1>
  
  <div class="nav">
    <a href="/sandbox">Test Sandbox</a>
    <a href="/sandbox/normal">Normal (No Sandbox)</a>
  </div>

  <h2>About Sandbox</h2>
  <p>Sandbox mode blocks dangerous access in templates:</p>
  <ul>
    <li><code>{{ user.__proto__ }}</code> - Blocked</li>
    <li><code>{{ user.constructor }}</code> - Blocked</li>
    <li><code>{{ process.env.API_KEY }}</code> - Blocked</li>
  </ul>

  <h2>Try It</h2>
  <div class="test-case">
    <a href="/sandbox">Click here to test sandbox mode</a>
  </div>
  
  <h2>Code Example</h2>
  <pre>// Enable sandbox
const env = nunjucks.createSandboxedEnvironment(loader);
// Or via option
const env = nunjucks.createEnvironment(loader, { sandbox: true });</pre>
</body>
</html>
  `);
});

router.get('/test', async (req, res) => {
  const context = {
    user: {
      name: 'John',
      admin: true,
      data: { secret: 'API_KEY_123' }
    }
  };

  const results = [];

  const tests = [
    { name: 'Normal property', template: '{{ user.name }}', sandbox: false },
    { name: 'Access __proto__ (blocked in sandbox)', template: '{{ user.__proto__ }}', sandbox: true, expectError: true },
    { name: 'Access constructor (blocked in sandbox)', template: '{{ user.constructor }}', sandbox: true, expectError: true },
    { name: 'Access toString (blocked in sandbox)', template: '{{ user.toString }}', sandbox: true, expectError: true },
  ];

  for (const test of tests) {
    const env = test.sandbox ? sandboxEnv : normalEnv;
    try {
      const result = await env.renderString(test.template, context);
      results.push({ name: test.name, result, error: null, blocked: false });
    } catch (e) {
      results.push({ name: test.name, result: null, error: e.message, blocked: true });
    }
  }

  res.type('html').send(`
<!DOCTYPE html>
<html>
<head>
  <title>Sandbox Test Results</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { color: #2c3e50; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { text-align: left; padding: 12px; border: 1px solid #ddd; }
    th { background: #3498db; color: white; }
    .blocked { background: #fee; color: #c0392b; }
    .allowed { background: #efe; color: #27ae60; }
    a { color: #3498db; }
  </style>
</head>
<body>
  <h1>🔒 Sandbox Test Results</h1>
  <p><a href="/sandbox">← Back to Sandbox Demo</a></p>
  
  <table>
    <tr>
      <th>Test</th>
      <th>Result</th>
      <th>Status</th>
    </tr>
    ${results.map(r => `
    <tr>
      <td>${r.name}</td>
      <td>${r.error ? r.error : r.result}</td>
      <td class="${r.blocked ? 'blocked' : 'allowed'}">${r.blocked ? '🚫 BLOCKED' : '✅ ALLOWED'}</td>
    </tr>
    `).join('')}
  </table>
</body>
</html>
  `);
});

router.get('/normal', async (req, res) => {
  const context = {
    user: {
      name: 'John',
      admin: true
    }
  };

  const results = [];

  const tests = [
    { name: 'Normal property', template: '{{ user.name }}' },
    { name: 'Access __proto__ (DANGEROUS!)', template: '{{ user.__proto__ }}' },
    { name: 'Access constructor', template: '{{ user.constructor }}' },
  ];

  for (const test of tests) {
    try {
      const result = await normalEnv.renderString(test.template, context);
      results.push({ name: test.name, result, error: null });
    } catch (e) {
      results.push({ name: test.name, result: null, error: e.message });
    }
  }

  res.type('html').send(`
<!DOCTYPE html>
<html>
<head>
  <title>Normal Mode (No Sandbox)</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { color: #e74c3c; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { text-align: left; padding: 12px; border: 1px solid #ddd; }
    th { background: #e74c3c; color: white; }
    .danger { background: #fee; color: #c0392b; }
    a { color: #3498db; }
  </style>
</head>
<body>
  <h1>⚠️ Normal Mode (No Sandbox)</h1>
  <p><a href="/sandbox">← Back to Sandbox Demo</a></p>
  
  <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
    <strong>⚠️ Warning:</strong> Without sandbox, templates can access dangerous properties!
  </div>

  <table>
    <tr>
      <th>Test</th>
      <th>Result</th>
      <th>Status</th>
    </tr>
    ${results.map(r => `
    <tr>
      <td>${r.name}</td>
      <td>${r.error ? r.error : r.result}</td>
      <td class="${r.name.includes('__proto__') || r.name.includes('constructor') ? 'danger' : ''}">${r.error ? '❌ Error' : '✅ Allowed'}</td>
    </tr>
    `).join('')}
  </table>
</body>
</html>
  `);
});

export { router as sandboxRouter };
