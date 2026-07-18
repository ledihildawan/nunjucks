import { parse } from './src/compiler/parser/index.js';

const template = 'Hello {{ user_name }}, welcome to {{ app_name }}!';

console.log('Template:', JSON.stringify(template));
console.log('');

// "Hello {{ " = 9 chars (0-8), then "user_name" starts at 0-indexed position 9
// But wait, let me count:
// H(0) e(1) l(2) l(3) o(4) (5) {(6) {(7) (8) (space)(9) u(10)...
// Actually let me recount:
// "Hello {{ " = H(0) e(1) l(2) l(3) o(4) (space)(5) {(6) {(7) (space)(8) u(9)...

console.log('Character positions (0-indexed):');
for (let i = 0; i < 15; i++) {
  console.log(`  ${i}: '${template[i]}'`);
}
console.log('');

// user_name starts at position 9 (0-indexed)
// colno in nunjucks is typically 0-indexed
// So user_name should have colno: 9

console.log('Expected:');
console.log('  lineno: 1');
console.log('  colno: 9 (0-indexed for user_name)');
console.log('');

const ast = parse(template, { dev: true, undefined: 'strict' }, 'test.njk');

console.log('AST structure:');
ast.children.forEach((child, i) => {
  console.log(`Child ${i}: type=${child.type}`);
  if (child.lineno !== undefined) console.log(`  lineno=${child.lineno}, colno=${child.colno}`);
  if (child.children) {
    child.children.forEach((c, j) => {
      console.log(`  GrandChild ${j}: type=${c.type}`);
      console.log(`    lineno=${c.lineno}, colno=${c.colno}`);
    });
  }
});
