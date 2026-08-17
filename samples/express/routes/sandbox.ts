import express, { type Request, type Response, type Router } from 'express';
import { createSandboxSuites, renderTable, runTests } from '../lib/domain/sandbox-demo.ts';

// WHY: the shell route owns the Node boundary — it supplies the real process reference for
// the sandbox scanner probes so lib/domain stays environment-neutral (mirrors routes/errors.ts).
const sandboxSuites = createSandboxSuites({ process });

const router: Router = express.Router();

router.get('/', (_req: Request, res: Response) => {
  // WHY: inline HTML for demo brevity; production should use .njk templates with autoescape
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
  <p>The engine's prototype-escape guard is always on — inherited
  <code>__proto__</code>/<code>constructor</code>/<code>prototype</code> reads render as
  <code>undefined</code> even without sandbox. Sandbox mode upgrades that mask to a hard
  failure and adds write/call gates:</p>
  <ul>
    <li><code>{{ user.__proto__ }}</code> - default: renders undefined; sandbox: throws</li>
    <li><code>{{ user.constructor }}</code> - default: renders undefined; sandbox: throws</li>
    <li><code>{{ process.env.API_KEY }}</code> - unreachable: templates only see context keys, never Node globals</li>
  </ul>

  <h2>Try It</h2>
  <div class="test-case">
    <a href="/sandbox/test">Click here to test sandbox mode</a>
  </div>

  <h2>Code Example</h2>
  <pre>// Enable sandbox via the factory config
const njk = nunjucks({ security: { sandbox: true } });
const html = await njk.render(template, context);

// Allowlist mode - only allow specific keys
const allowlistNjk = nunjucks({
  security: {
    sandbox: true,
    sandboxAllowlist: ['user', 'name'],
    sandboxMode: 'allowlist'
  }
});</pre>
</body>
</html>
  `);
});

sandboxSuites.reduce<Router>((acc, suite) => {
  acc.get(`/${suite.key}`, async (_req: Request, res: Response) => {
    const table = await runTests({
      tests: suite.tests,
      context: suite.context,
      config: suite.config,
    });
    res.type('html').send(renderTable(table, suite));
  });
  return acc;
}, router);

export { router as sandboxRouter };
