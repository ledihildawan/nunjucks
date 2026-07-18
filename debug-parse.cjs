const nunjucks = require('./packages/@nunjucks/nunjucks.js');

const template = 'Hello {{ user_name }}, welcome to {{ app_name }}!';

console.log('Template:', template);
console.log('');

// Calculate column manually
// "Hello {{ " = 9 chars, then "user_name" starts at position 9 (0-indexed) or 10 (1-indexed)
console.log('Character analysis:');
for (let i = 0; i < template.length; i++) {
  if (i >= 6 && i <= 12) {
    console.log(`Position ${i} (1-indexed ${i+1}): '${template[i]}'`);
  }
}
console.log('');

// The actual positions:
// Position 8 (0-indexed) = '{' of {{
// Position 9 (0-indexed) = '{' of {{
// Position 10 (0-indexed) = ' ' (space after {{)
// Position 11 (0-indexed) = 'u' of user_name

console.log('Expected:');
console.log('  lineno: 1');
console.log('  colno: 11 (0-indexed) or 12 (if 1-indexed and counting the space before u)');
console.log('');

try {
  nunjucks.render(template, {}, { dev: true, undefined: 'strict' });
} catch (err) {
  console.log('Error reported:');
  console.log('  lineno:', err.lineno);
  console.log('  colno:', err.colno);
  console.log('');
  console.log('Discrepancy:');
  console.log('  Parser colno:', err.colno);
  console.log('  Expected (1-indexed, pointing to u): 11');
  console.log('  Difference:', err.colno - 11);
}
