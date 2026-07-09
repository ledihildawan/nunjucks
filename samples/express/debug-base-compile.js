import { compile } from '../../nunjucks/src/compiler.js';

console.log('=== base.njk compiled ===');
const base = '{% block block1 %}Bar{% endblock %}{% block block2 %}Baz{% endblock %}';
console.log(compile(base, [], [], 'base.html', {}));

console.log('\n=== inline extends base compiled ===');
const inline = '{% extends "base.njk" %}{% block block1 %}CHILD{% endblock %}';
console.log(compile(inline, [], [], 'inline.html', {}));