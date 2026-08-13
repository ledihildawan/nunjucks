import express, { type Router, type Request, type Response } from 'express';
import { localizedTime } from '../lib/io/clock.ts';

const router: Router = express.Router();

router.get('/', (_req: Request, res: Response) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Remote Extension Demo</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
    h1 { color: #2c3e50; }
    .demo { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
    pre { background: #2c3e50; color: #ecf0f1; padding: 15px; border-radius: 5px; overflow-x: auto; }
    .note { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; }
    a { color: #3498db; }
  </style>
</head>
<body>
  <h1>Remote Extension Demo</h1>

  <div class="note">
    <strong>Note:</strong> This demo shows how to use the <code>{% remote %}</code> tag
    to load content dynamically via AJAX.
  </div>

  <h2>How It Works</h2>
  <pre>{% remote '/api/content' %}
  Loading...
{% error %}
  Failed to load content
{% endremote %}</pre>

  <h2>Demo</h2>
  <div class="demo">
    <div id="demo1">
      {% remote '/api/slow-content' %}
        <span style="color: #999;">Loading content...</span>
      {% error %}
        <span style="color: red;">Failed to load</span>
      {% endremote %}
    </div>
  </div>

  <h2>API Endpoints</h2>
  <ul>
    <li><code>GET /remote/api/hello</code> - Returns simple greeting</li>
    <li><code>GET /remote/api/time</code> - Returns current time</li>
    <li><code>GET /remote/api/slow</code> - Simulates slow loading (2s delay)</li>
    <li><code>GET /remote/api/error</code> - Returns 500 error</li>
  </ul>

  <p><a href="/">Back to Index</a></p>
</body>
</html>
  `);
});

router.get('/api/hello', (_req: Request, res: Response) => {
  res.send('<strong>Hello from remote API!</strong>');
});

router.get('/api/time', (_req: Request, res: Response) => {
  res.send(`Current time: <strong>${localizedTime()}</strong>`);
});

router.get('/api/slow', (req: Request, res: Response) => {
  setTimeout(() => {
    if (req.destroyed) { return; }
    res.send('<strong>Slow content loaded!</strong>');
  }, 2000);
});

router.get('/api/error', (_req: Request, res: Response) => {
  res.status(500).send('Server error');
});

export { router as remoteRouter };