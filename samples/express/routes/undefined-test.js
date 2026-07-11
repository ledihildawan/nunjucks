import express from 'express';
import { createContainer } from '../../../src/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIEWS = path.join(__dirname, '..', 'views');

const router = express.Router();

const createTestEnv = (undefinedMode) => {
  const c = createContainer();
  return c.environment(c.loader.fileSystem(VIEWS), {
    autoescape: true,
    dev: true,
    ide: 'vscode',
    undefined: undefinedMode
  });
};

const strictEnv = createTestEnv('strict');

router.get('/strict', async (req, res) => {
  const template = '{{ user.name }}';
  const context = { user: undefined };
  
  console.log('=== DEBUG ===');
  console.log('Template:', template);
  
  try {
    await strictEnv.renderString(template, context);
    res.send('Should have thrown error');
  } catch (e) {
    console.log('Error templatePath:', e.templatePath);
    console.log('Error path:', e.path);
    console.log('Error templateName:', e.templateName);
    console.log('Full error:', JSON.stringify({
      templatePath: e.templatePath,
      path: e.path,
      templateName: e.templateName
    }, null, 2));
    res.status(500).type('html').send(e.toHtmlString());
  }
});

export { router as undefinedRouter };
