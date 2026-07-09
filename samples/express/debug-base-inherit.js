import { compile } from '../../nunjucks/src/compiler.js';

console.log('=== base-inherit.njk compiled ===');
const src = '{% extends "base.njk" %}{% block block1 %}*{{ super() }}*{% endblock %}';
console.log(compile(src, [], [], 'base-inherit.html', {}));