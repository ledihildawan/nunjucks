import nunjucks from '../../nunjucks/index.js';

// Override getBlock and addBlock to trace
const EnvProto = Object.getPrototypeOf(nunjucks.Environment.prototype);
const origGetBlock = EnvProto.constructor.prototype.getBlock;
const origAddBlock = EnvProto.constructor.prototype.addBlock;

EnvProto.constructor.prototype.addBlock = function(name, block) {
  console.log(`addBlock("${name}", ${block.toString().substring(0,30)}...)`);
  console.log(`  context.blocks["${name}"] before:`, this.blocks[name]?.map(b => b.toString().substring(0,30)));
  const result = origAddBlock.call(this, name, block);
  console.log(`  context.blocks["${name}"] after:`, this.blocks[name]?.map(b => b.toString().substring(0,30)));
  return result;
};

EnvProto.constructor.prototype.getBlock = function(name) {
  console.log(`getBlock("${name}")`);
  console.log(`  context.blocks["${name}"]:`, this.blocks[name]?.map(b => b.toString().substring(0,30)));
  const result = origGetBlock.call(this, name);
  console.log(`  returning:`, result?.toString().substring(0,30));
  return result;
};

var env = new nunjucks.Environment(new nunjucks.FileSystemLoader('tests/templates'));

async function test() {
  console.log('=== Test with extends ===');
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