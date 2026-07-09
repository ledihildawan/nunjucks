// Trace getSuper and context.blocks with more detail
import nunjucks from '../../nunjucks/index.js';

var EnvProto = nunjucks.Environment.prototype;
var origGetSuper = EnvProto.getSuper;
EnvProto.getSuper = function(env, name, block, frame, runtime) {
  console.log(`\n=== getSuper called ===`);
  console.log(`name: "${name}"`);
  console.log(`block: ${block.toString().substring(0, 50)}...`);
  console.log(`this.blocks["${name}"]:`, this.blocks[name]?.map(b => b.toString().substring(0, 40)));
  var idx = (this.blocks[name] || []).indexOf(block);
  console.log(`indexOf(block): ${idx}`);
  var blk = this.blocks[name]?.[idx + 1];
  console.log(`this.blocks["${name}"][idx + 1]:`, blk?.toString().substring(0, 40));
  if (idx === -1 || !blk) {
    console.log('ERROR: no super block available!');
  }
  return origGetSuper.call(this, env, name, block, frame, runtime);
};

var origGetBlock = EnvProto.getBlock;
EnvProto.getBlock = function(name) {
  console.log(`\n=== getBlock called ===`);
  console.log(`name: "${name}"`);
  console.log(`this.blocks["${name}"]:`, this.blocks[name]?.map(b => b.toString().substring(0, 40)));
  return origGetBlock.call(this, name);
};

var env = new nunjucks.Environment(new nunjucks.FileSystemLoader('tests/templates'));

async function test() {
  console.log('=== 2-level inheritance ===');
  try {
    var result = await env.render('base-inherit.njk', {});
    console.log('Result:', JSON.stringify(result));
  } catch (e) {
    console.log('Error:', e.message, e.stack);
  }

  console.log('\n\n=== 3-level inheritance ===');
  try {
    var result = await env.renderString('{% extends "base-inherit.njk" %}{% block block1 %}CHILD{% endblock %}', {});
    console.log('Result:', JSON.stringify(result));
  } catch (e) {
    console.log('Error:', e.message, e.stack);
  }
}

test();