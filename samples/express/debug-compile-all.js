// Detailed trace of 3-level inheritance
import * as compiler from '../../nunjucks/src/compiler.js';
import * as lexer from '../../nunjucks/src/lexer.js';
import * as parser from '../../nunjucks/src/parser.js';
import { Environment } from '../../nunjucks/src/environment.js';

console.log('=== Parsing base-inherit.njk ===');
const baseInheritSrc = `{% extends "base.njk" %}
{% block block1 %}*{{ super() }}*{% endblock %}`;
const baseInheritAst = parser.parse(baseInheritSrc, {}, { isInBlock: false });
console.log('AST OK');

console.log('\n=== Compiling inline.html ===');
const inlineSrc = `{% extends "base-inherit.njk" %}{% block block1 %}CHILD{% endblock %}`;
const inlineCompiled = compiler.compile(inlineSrc, [], [], 'inline.html', {});
console.log('Compiled inline:');
console.log(inlineCompiled);

console.log('\n=== Compiling base-inherit.njk ===');
const baseInheritCompiled = compiler.compile(baseInheritSrc, [], [], 'base-inherit.html', {});
console.log('Compiled base-inherit:');
console.log(baseInheritCompiled);

console.log('\n=== Compiling base.njk ===');
const baseSrc = `Foo{% block block1 %}Bar{% endblock %}{% block block2 %}Baz{% endblock %}Fizzle`;
const baseCompiled = compiler.compile(baseSrc, [], [], 'base.html', {});
console.log('Compiled base:');
console.log(baseCompiled);