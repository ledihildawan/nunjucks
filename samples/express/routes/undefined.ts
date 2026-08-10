import express, { type Router, type Request, type Response, type NextFunction } from 'express';
import { renderTemplate as renderBase } from '../lib/render-template.ts';

const router: Router = express.Router();

interface RenderTemplateOptions<TContext extends Record<string, unknown>> {
  template: string;
  context: TContext;
  config?: Record<string, unknown>;
}

const renderTemplate = async <TContext extends Record<string, unknown>>(
  { template, context, config = {} }: RenderTemplateOptions<TContext>,
) => renderBase(template, { context, config: {
  autoescape: true,
  dev: true,
  ide: 'vscode',
  ...config
}});

router.get('/', async (_req: Request, res: Response) => {
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
  <h1>Undefined Types Demo</h1>

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
  <pre>// via factory config
const njk = nunjucks({ undefined: 'strict' });
const html = await njk.render(template, context);</pre>

  <div class="nav">
    <a href="/">Back to Home</a>
  </div>
</body>
</html>
  `);
});

router.get('/strict', async (_req: Request, res: Response, next: NextFunction) => {
  const template = '{{ user.name }}';
  const context: Record<string, unknown> = { user: undefined };

  try {
    await renderTemplate({ template, context, config: { undefined: 'strict' } });
    res.send('Should have thrown error');
  } catch (e) {
    next(e);
  }
});

router.get('/debug', async (_req: Request, res: Response, next: NextFunction) => {
  const template = '{{ user.testing }}';
  const context: Record<string, unknown> = { user: undefined };

  try {
    const result = await renderTemplate({ template, context, config: { undefined: 'debug' } });
    // WHY: inline HTML for demo brevity; production should use .njk templates with autoescape
    res.type('html').send(`
<!DOCTYPE html>
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
  <h1>Debug Mode - No Error</h1>
  <p>Template: <code>{{ user.testing }}</code></p>
  <p>Context: <code>{ user: undefined }</code></p>
  <p><strong>Result:</strong> "${result}"</p>
  <p><a href="/undefined">Back to Undefined Types Demo</a></p>
</body>
</html>`);
  } catch (e) {
    next(e);
  }
});

router.get('/chainable', async (_req: Request, res: Response, next: NextFunction) => {
  const template = '{{ user.name }}';
  const context: Record<string, unknown> = { user: undefined };

  try {
    const result = await renderTemplate({ template, context, config: { undefined: 'chainable' } });

    // WHY: inline HTML for demo brevity; production should use .njk templates with autoescape
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
  <h1>Chainable Mode - Silent</h1>
  <p>Template: <code>{{ user.name }}</code></p>
  <p>Context: <code>{ user: undefined }</code></p>

  <div class="result">
    <strong>Output:</strong> "${result}"
  </div>

  <p>No warning in console - silent "undefined" string returned.</p>

  <p><a href="/undefined">Back to Undefined Types Demo</a></p>
</body>
</html>
  `);
  } catch (e) {
    next(e);
  }
});

router.get('/strict-nested', async (_req: Request, res: Response, next: NextFunction) => {
  const template = '{{ user.profile.name }}';
  const context: Record<string, unknown> = { user: undefined };

  try {
    await renderTemplate({ template, context, config: { undefined: 'strict' } });
    res.send('Should have thrown error');
  } catch (e) {
    next(e);
  }
});

router.get('/strict-array', async (_req: Request, res: Response, next: NextFunction) => {
  const template = '{{ items }}';
  const context: Record<string, unknown> = { items: undefined };

  try {
    await renderTemplate({ template, context, config: { undefined: 'strict' } });
    res.send('Should have thrown error');
  } catch (e) {
    next(e);
  }
});

export { router as undefinedRouter };
