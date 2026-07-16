import express from 'express';
import nunjucks from '../../../src/index.js';

const router = express.Router();

const renderTemplate = async (template, context, config = {}) => {
  return await nunjucks(template, context, {
    autoescape: true,
    dev: true,
    ide: 'vscode',
    ...config
  });
};

router.get('/strict', async (req, res) => {
  const template = '{{ user.name }}';
  const context = { user: undefined };

  console.log('=== DEBUG ===');
  console.log('Template:', template);

  try {
    await renderTemplate(template, context, { undefined: 'strict' });
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
    res.status(500).type('html').send(e.output());
  }
});

export { router as undefinedRouter };
