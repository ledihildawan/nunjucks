import express from 'express';

export const remoteRouter = express.Router();

remoteRouter.get('/', (req, res) => {
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
  <h1>🔌 Remote Extension Demo</h1>
  
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
        <span style="color: #999;">⏳ Loading content...</span>
      {% error %}
        <span style="color: red;">❌ Failed to load</span>
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

  <p><a href="/">← Back to Index</a></p>
</body>
</html>
  `);
});

remoteRouter.get('/api/hello', (req, res) => {
  res.send('<strong>Hello from remote API!</strong> 🎉');
});

remoteRouter.get('/api/time', (req, res) => {
  res.send(`Current time: <strong>${new Date().toLocaleTimeString()}</strong>`);
});

remoteRouter.get('/api/slow', (req, res) => {
  setTimeout(() => {
    res.send('<strong>Slow content loaded!</strong> 🐢');
  }, 2000);
});

remoteRouter.get('/api/error', (req, res) => {
  res.status(500).send('Server error');
});
