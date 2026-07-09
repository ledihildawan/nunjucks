// Inject trace into compiled code
import nunjucks from '../../nunjucks/index.js';

var env = new nunjucks.Environment(new nunjucks.FileSystemLoader('tests/templates'));

// Hook into Context methods via the environment
const origRender = env.render.bind(env);
env.render = async function(path, ctx, parentFrame, forceCompile) {
  console.log('\n=== env.render called ===');
  return origRender(path, ctx, parentFrame, forceCompile);
};

// Let's just run the test and see the actual result
async function test() {
  // Just render base.njk alone first
  console.log('=== Render base.njk directly ===');
  var result = await env.render('base.njk', {});
  console.log('base.njk result:', JSON.stringify(result));

  // Now render inline template that extends
  console.log('\n=== Render inline extends ===');
  result = await env.renderString('{% extends "base.njk" %}{% block block1 %}CHILD{% endblock %}', {});
  console.log('extends result:', JSON.stringify(result));
}

test();