import { describe, test, expect } from 'bun:test';
import { TOGGLE_SCRIPT } from './script.js';

describe('TOGGLE_SCRIPT', () => {
  test('is a non-empty string', () => {
    expect(typeof TOGGLE_SCRIPT).toBe('string');
    expect(TOGGLE_SCRIPT.length).toBeGreaterThan(0);
  });

  test('contains stack toggle logic', () => {
    expect(TOGGLE_SCRIPT).toContain('initStackToggle');
    expect(TOGGLE_SCRIPT).toContain('initContextToggle');
    expect(TOGGLE_SCRIPT).toContain('btn-toggle-stack');
    expect(TOGGLE_SCRIPT).toContain('VISIBLE_COUNT');
  });

  test('contains context rendering helpers', () => {
    expect(TOGGLE_SCRIPT).toContain('createNode');
    expect(TOGGLE_SCRIPT).toContain('batchRender');
    expect(TOGGLE_SCRIPT).toContain('escapeHtml');
  });

  test('is wrapped in an IIFE', () => {
    expect(TOGGLE_SCRIPT.trim()).toMatch(/^\(function\(\)/);
    expect(TOGGLE_SCRIPT.trim()).toMatch(/}\)\(\);$/);
  });

  test('handles DOMContentLoaded and readyState', () => {
    expect(TOGGLE_SCRIPT).toContain('DOMContentLoaded');
    expect(TOGGLE_SCRIPT).toContain('document.readyState');
  });
});
