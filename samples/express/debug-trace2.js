// Manual trace by modifying template rendering
import nunjucks from '../../nunjucks/index.js';

var env = new nunjucks.Environment(new nunjucks.FileSystemLoader('tests/templates'));

// Wrap getTemplate to trace
const origGetTemplate = env.getTemplate.bind(env);
env.getTemplate = async function(name, eagerCompile, parentName, force) {
  console.log(`\n=== getTemplate("${name}") ===`);
  const tpl = await origGetTemplate(name, eagerCompile, parentName, force);
  console.log(`Template ${name} loaded. blocks keys:`, Object.keys(tpl.blocks || {}));
  if (tpl.blocks) {
    for (const k of Object.keys(tpl.blocks)) {
      console.log(`  blocks["${k}"]:`, tpl.blocks[k]?.toString().substring(0, 50));
    }
  }
  return tpl;
};

async function test() {
  console.log('=== Starting render ===');
  try {
    var result = await env.renderString(
      '{% extends "base.njk" %}{% block block1 %}CHILD{% endblock %}',
      {}
    );
    console.log('\nFinal Result:', JSON.stringify(result));
  } catch (e) {
    console.log('\nError:', e.message);
  }
}

test();