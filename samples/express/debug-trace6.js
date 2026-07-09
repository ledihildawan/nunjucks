// Trace Context creation and blocks
import nunjucks from '../../nunjucks/index.js';

var env = new nunjucks.Environment(new nunjucks.FileSystemLoader('tests/templates'));

// Hook into Template.render to trace context creation
const Template = nunjucks.Template;
const origRender = Template.prototype.render;
Template.prototype.render = async function(ctx, parentFrame) {
  console.log(`\n=== Template.render called ===`);
  console.log(`this.blocks:`, Object.keys(this.blocks || {}));
  if (this.blocks) {
    for (const k of Object.keys(this.blocks)) {
      console.log(`  this.blocks["${k}"]:`, this.blocks[k]?.toString().substring(0, 40));
    }
  }
  return origRender.call(this, ctx, parentFrame);
};

async function test() {
  console.log('=== Test with extends ===');
  var result = await env.renderString('{% extends "base.njk" %}{% block block1 %}CHILD{% endblock %}', {});
  console.log('\nResult:', JSON.stringify(result));
}

test();