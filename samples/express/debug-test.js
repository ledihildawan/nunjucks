import nunjucks from '../../nunjucks/index.js';

var env = new nunjucks.Environment(new nunjucks.FileSystemLoader('tests/templates'));

async function test() {
  console.log('=== Testing getBlock behavior ===');

  // Direct template without extends
  try {
    var result = await env.renderString('{% block block1 %}CHILD{% endblock %}', {});
    console.log('No extends result:', JSON.stringify(result));
  } catch (e) {
    console.log('No extends error:', e.message);
  }

  // 1-level extends
  try {
    var result = await env.renderString(
      '{% extends "base.njk" %}{% block block1 %}CHILD{% endblock %}',
      {}
    );
    console.log('1-level extends result:', JSON.stringify(result));
  } catch (e) {
    console.log('1-level extends error:', e.message);
  }

  // 1-level extends with super
  try {
    var result = await env.renderString(
      '{% extends "base.njk" %}{% block block1 %}{{ super() }}CHILD{% endblock %}',
      {}
    );
    console.log('1-level with super result:', JSON.stringify(result));
    console.log('Expected: FooBarCHILDBazFizzle');
  } catch (e) {
    console.log('1-level with super error:', e.message);
  }
}

test();