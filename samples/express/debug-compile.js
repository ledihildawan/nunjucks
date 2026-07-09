import { compile } from '../../nunjucks/src/compiler.js';

const src = '{% extends "base.njk" %}{% block block1 %}{{ super() }}BAR{% endblock %}';

console.log('=== Compiled code with line numbers ===\n');
const compiled = compile(src, [], [], 'child.html', {});
console.log(compiled);