import express from 'express';
import { createEnvironment, createFileSystemLoader } from '../../../nunjucks/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIEWS = path.join(__dirname, '..', 'views');

const router = express.Router();

const createTestEnv = (undefinedMode) => {
  const loader = createFileSystemLoader(VIEWS);
  return createEnvironment(loader, {
    autoescape: true,
    dev: true,
    ide: 'vscode',
    undefined: undefinedMode
  });
};

const strictEnv = createTestEnv('strict');
const debugEnv = createTestEnv('debug');
const chainableEnv = createTestEnv('chainable');

router.get('/', async (req, res) => {
  res.type('html').send(`
<!DOCTYPE html>
<html>
<head>
  <title>Undefined Types Demo</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { color: #2c3e50; }
    h2 { color: #3498db; border-bottom: 2px solid #3498db; padding-bottom: 8px; }
    .mode { background: #f8f9fa; padding: 15px; margin: 15px 0; border-radius: 8px; }
    .mode h3 { margin-top: 0; }
    .strict { border-left: 4px solid #e74c3c; }
    .debug { border-left: 4px solid #f39c12; }
    .chainable { border-left: 4px solid #27ae60; }
    code { background: #e9ecef; padding: 2px 6px; border-radius: 4px; }
    pre { background: #2c3e50; color: #ecf0f1; padding: 15px; border-radius: 8px; overflow-x: auto; }
    .nav { margin: 20px 0; }
    .nav a { display: inline-block; padding: 10px 15px; background: #3498db; color: white; border-radius: 5px; margin-right: 10px; text-decoration: none; }
    .nav a:hover { background: #2980b9; }
  </style>
</head>
<body>
  <h1>🔍 Undefined Types Demo</h1>
  
  <p>Nunjucks has 3 modes for handling undefined variables:</p>

  <div class="mode strict">
    <h3>1. strict - Error on undefined</h3>
    <p>Throws an error when a variable is undefined.</p>
    <p><code>undefined: 'strict'</code></p>
    <a href="/undefined/strict">Test strict mode</a>
  </div>

  <div class="mode debug">
    <h3>2. debug - Warning + "undefined" string</h3>
    <p>Shows console warning but continues rendering with "undefined" string.</p>
    <p><code>undefined: 'debug'</code></p>
    <a href="/undefined/debug">Test debug mode</a>
  </div>

  <div class="mode chainable">
    <h3>3. chainable - Silent "undefined"</h3>
    <p>Silent - returns "undefined" string without warning.</p>
    <p><code>undefined: 'chainable'</code> (default)</p>
    <a href="/undefined/chainable">Test chainable mode</a>
  </div>

  <h2>Code Example</h2>
  <pre>const env = createEnvironment(loader, {
  undefined: 'strict'  // or 'debug' or 'chainable'
});</pre>

  <div class="nav">
    <a href="/">← Back to Home</a>
  </div>
</body>
</html>
  `);
});

router.get('/strict', async (req, res) => {
  const template = '{{ user.name }}';
  const context = { user: undefined };
  
  try {
    await strictEnv.renderString(template, context);
    res.send('Should have thrown error');
  } catch (e) {
    res.type('html').send(`
<!DOCTYPE html>
<html>
<head>
  <title>Strict Mode Error</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { color: #e74c3c; }
    .error { background: #fee; border: 1px solid #e74c3c; padding: 15px; border-radius: 8px; }
    pre { background: #2c3e50; color: #ecf0f1; padding: 15px; border-radius: 8px; overflow-x: auto; }
    a { color: #3498db; }
  </style>
</head>
<body>
  <h1>🚫 Strict Mode - Error!</h1>
  <p>Template: <code>{{ user.name }}</code></p>
  <p>Context: <code>{ user: undefined }</code></p>
  
  <div class="error">
    <strong>Error:</strong> ${e.message}
  </div>

  <p><a href="/undefined">← Back to Undefined Types Demo</a></p>
</body>
</html>
    `);
  }
});

router.get('/debug', async (req, res) => {
  const template = `<!DOCTYPE html>
<html>
<head>
  <title>Debug Mode</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { color: #f39c12; }
    .result { background: #fff3cd; border: 1px solid #f39c12; padding: 15px; border-radius: 8px; }
    code { background: #e9ecef; padding: 2px 6px; border-radius: 4px; }
    a { color: #3498db; }
  </style>
</head>
<body>
  <h1>Debug Mode - Member Access Throws Error</h1>
  <p>Template: <code>{{ user.testing }}</code></p>
  <p>Context: <code>{ user: undefined }</code></p>

  <p><strong>Note:</strong> In debug mode, member access like <code>user.testing</code> throws an error (not just warning)!</p>

  <p><a href="/undefined">← Back to Undefined Types Demo</a></p>
</body>
</html>`;
  const context = { user: undefined };

  const result = await debugEnv.renderString(template, context);
  res.type('html').send(result);
});

router.get('/chainable', async (req, res) => {
  const template = '{{ user.name }}';
  const context = { user: undefined };
  
  const result = await chainableEnv.renderString(template, context);
  
  res.type('html').send(`
<!DOCTYPE html>
<html>
<head>
  <title>Chainable Mode</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { color: #27ae60; }
    .result { background: #d4edda; border: 1px solid #27ae60; padding: 15px; border-radius: 8px; }
    code { background: #e9ecef; padding: 2px 6px; border-radius: 4px; }
    a { color: #3498db; }
  </style>
</head>
<body>
  <h1>✅ Chainable Mode - Silent</h1>
  <p>Template: <code>{{ user.name }}</code></p>
  <p>Context: <code>{ user: undefined }</code></p>
  
  <div class="result">
    <strong>Output:</strong> "${result}"
  </div>
  
  <p>No warning in console - silent "undefined" string returned.</p>

  <p><a href="/undefined">← Back to Undefined Types Demo</a></p>
</body>
</html>
  `);
});

export { router as undefinedRouter };
