// Trace Context methods
import nunjucks from '../../nunjucks/index.js';

var ContextProto = nunjucks.Environment.Context.prototype;
var origGetSuper = ContextProto.getSuper;
ContextProto.getSuper = function(env, name, block, frame, runtime) {
  console.log(`\n=== Context.getSuper called ===`);
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

var origGetBlock = ContextProto.getBlock;
ContextProto.getBlock = function(name) {
  console.log(`\n=== Context.getBlock called ===`);
  console.log(`name: "${name}"`);
  console.log(`this.blocks["${name}"]:`, this.blocks[name]?.map(b => b.toString().substring(0, 40)));
  return origGetBlock.call(this, name);
};

var origAddBlock = ContextProto.addBlock;
ContextProto.addBlock = function(name, block) {
  console.log(`\n=== Context.addBlock called ===`);
  console.log(`name: "${name}"`);
  console.log(`block: ${block.toString().substring(0, 50)}...`);
  console.log(`this.blocks["${name}"] BEFORE:`, this.blocks[name]?.map(b => b.toString().substring(0, 40)));
  var result = origAddBlock.call(this, name, block);
  console.log(`this.blocks["${name}"] AFTER:`, this.blocks[name]?.map(b => b.toString().substring(0, 40)));
  return result;
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