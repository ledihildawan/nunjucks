// More detailed trace
import nunjucks from '../../nunjucks/index.js';

var env = new nunjucks.Environment(new nunjucks.FileSystemLoader('tests/templates'));

async function test() {
  console.log('=== Simple base test ===');
  var result = await env.renderString('{% block block1 %}Bar{% endblock %}', {});
  console.log('Result:', JSON.stringify(result));

  console.log('\n=== With extends ===');
  result = await env.renderString('{% extends "base.njk" %}{% block block1 %}CHILD{% endblock %}', {});
  console.log('Result:', JSON.stringify(result));
  console.log('Expected: "FooCHILDBazFizzle"');
}

test();