// Trace the template compilation
import nunjucks from '../../nunjucks/index.js';
import { compile } from '../../nunjucks/src/compiler.js';

var env = new nunjucks.Environment(new nunjucks.FileSystemLoader('tests/templates'));

async function test() {
  // Compile the template to see what blocks it produces
  const src = '{% extends "base.njk" %}{% block block1 %}CHILD{% endblock %}';
  const compiled = compile(src, [], [], 'inline.html', {});

  console.log('=== Compiled template ===');
  console.log(compiled);

  console.log('\n=== Now rendering ===');
  var result = await env.renderString(src, {});
  console.log('Result:', JSON.stringify(result));
}

test();