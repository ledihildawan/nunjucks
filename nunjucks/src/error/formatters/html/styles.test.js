import { describe, test, expect } from 'bun:test';
import { CSS, CSS_VARS, PRODUCTION_BODY } from './styles.js';

describe('CSS', () => {
  test('is a non-empty string', () => {
    expect(typeof CSS).toBe('string');
    expect(CSS.length).toBeGreaterThan(0);
  });

  test('contains theme layer', () => {
    expect(CSS).toContain('@layer theme');
    expect(CSS).toContain('color-scheme');
  });

  test('contains reset layer', () => {
    expect(CSS).toContain('@layer reset');
    expect(CSS).toContain('box-sizing');
  });

  test('contains component classes', () => {
    expect(CSS).toContain('.error-title');
    expect(CSS).toContain('.code-block');
    expect(CSS).toContain('.stack-container');
    expect(CSS).toContain('.ctx-tree');
  });

  test('contains layout classes', () => {
    expect(CSS).toContain('.error-wrapper');
    expect(CSS).toContain('.error-header');
    expect(CSS).toContain('.error-body');
    expect(CSS).toContain('.error-footer');
  });
});

describe('CSS_VARS', () => {
  test('is an empty string', () => {
    expect(CSS_VARS).toBe('');
  });
});

describe('PRODUCTION_BODY', () => {
  test('is a non-empty string', () => {
    expect(typeof PRODUCTION_BODY).toBe('string');
    expect(PRODUCTION_BODY.length).toBeGreaterThan(0);
  });

  test('contains production HTML elements', () => {
    expect(PRODUCTION_BODY).toContain('prod-main');
    expect(PRODUCTION_BODY).toContain('Rendering Interrupted');
    expect(PRODUCTION_BODY).toContain('Internal Server Error');
    expect(PRODUCTION_BODY).toContain('Try Again');
  });

  test('contains SVG icon', () => {
    expect(PRODUCTION_BODY).toContain('<svg');
    expect(PRODUCTION_BODY).toContain('</svg>');
  });
});
