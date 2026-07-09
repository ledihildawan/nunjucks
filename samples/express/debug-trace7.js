// Test 3-level inheritance
import nunjucks from '../../nunjucks/index.js';

var env = new nunjucks.Environment(new nunjucks.FileSystemLoader('tests/templates'));

async function test() {
  console.log('=== base-inherit.njk (2-level) ===');
  var result = await env.render('base-inherit.njk', {});
  console.log('Result:', JSON.stringify(result));
  console.log('Expected: "Foo*Bar*BazFizzle"');

  console.log('\n=== inline.html (3-level via renderString) ===');
  // inline.html extends base-inherit.njk
  // base-inherit.njk extends base.njk
  result = await env.renderString('{% extends "base-inherit.njk" %}{% block block1 %}CHILD{% endblock %}', {});
  console.log('Result:', JSON.stringify(result));
  console.log('Expected: "Foo*CHILD*BazFizzle" or similar');
}

test();