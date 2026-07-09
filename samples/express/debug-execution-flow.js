// Simulate 3-level inheritance execution
// Let me trace what happens step by step

console.log('=== 3-Level Inheritance Execution Trace ===\n');

console.log('TEMPLATES:');
console.log('base.njk:      Foo{% block block1 %}Bar{% endblock %}{% block block2 %}Baz{% endblock %}Fizzle');
console.log('base-inherit:  {% extends "base.njk" %}{% block block1 %}*{{ super() }}*{% endblock %}');
console.log('inline.html:   {% extends "base-inherit.njk" %}{% block block1 %}CHILD{% endblock %}');

console.log('\n=== Execution Flow ===\n');

console.log('1. inline.root() starts');
console.log('   - Gets base-inherit.njk as parentTemplate');
console.log('   - Adds base-inherit blocks to context:');
console.log('     context.blocks["block1"] = [base-inherit.b_block1]');
console.log('   - Calls context.getBlock("block1") -> returns base-inherit.b_block1');
console.log('   - Executes base-inherit.b_block1(env, context, frame, runtime)');

console.log('\n2. base-inherit.b_block1 executes');
console.log('   - Outputs "*"');
console.log('   - Calls context.getSuper(env, "block1", b_block1, frame, runtime)');
console.log('   - getSuper looks for b_block1 in context.blocks["block1"]');
console.log('   - context.blocks["block1"] = [base-inherit.b_block1]');
console.log('   - indexOf(base-inherit.b_block1) = 0');
console.log('   - context.blocks["block1"][1] = ??? (undefined!)');

console.log('\n   PROBLEM: context.blocks["block1"] only has [base-inherit.b_block1]');
console.log('   The full chain should be: [inline.b_block1, base-inherit.b_block1, base.b_block1]');
console.log('   But when inline.root() ran, it only saw base-inherit blocks, not base blocks!');

console.log('\n3. Why is output "FooCHILDBazFizzle"?');
console.log('   Because base-inherit.rootRenderFunc returns parentTemplate.rootRenderFunc');
console.log('   When that runs, context.getBlock("block1") returns inline.b_block1 (at index 0)');
console.log('   So "CHILD" is output, and base-inherit.b_block1 is NEVER properly executed!');

console.log('\n=== Root Cause ===');
console.log('When base-inherit.b_block1 tries to call super(), the context only has');
console.log('[base-inherit.b_block1], not the full chain.');
console.log('The parent (base.b_block1) was never added to context.blocks!');

console.log('\n=== Solution ===');
console.log('Need to build full block chain BEFORE any block executes.');
console.log('The chain should be accumulated as we traverse through extends.');