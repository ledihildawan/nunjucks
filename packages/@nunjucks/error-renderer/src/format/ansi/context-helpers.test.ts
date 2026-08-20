import { describe, expect, test } from 'bun:test';
import picocolors from 'picocolors';
import { renderContextAnsi } from './context-helpers.ts';

describe('renderContextAnsi', () => {
  test('renders the bold header plus scalar entries', () => {
    const output = renderContextAnsi({ user: 'admin', count: 3 });
    expect(output).toContain(picocolors.bold('Render Context:'));
    expect(output).toContain('user "admin"');
    expect(output).toContain('count 3');
  });

  test('expands nested objects one level with indented key/value rows', () => {
    const output = renderContextAnsi({ profile: { name: 'ada' } });
    expect(output).toContain('profile :');
    expect(output).toContain('name: "ada"');
  });

  test('redacts blocked keys instead of rendering their values', () => {
    const output = renderContextAnsi({ password: 'hunter2' }, ['password']);
    expect(output).toContain('password "[Redacted]"');
    expect(output).not.toContain('hunter2');
  });

  test('collapses arrays to an Array(n) marker', () => {
    const output = renderContextAnsi({ items: [1, 2, 3] });
    expect(output).toContain('items Array(3)');
  });
});
