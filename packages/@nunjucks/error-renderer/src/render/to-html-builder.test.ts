import { describe, test, expect } from 'bun:test';
import { buildErrorHeader, buildErrorFooter, buildErrorBodyContent, buildHtmlWrapper } from './to-html-builder.ts';
import type { ClassifiedError, ErrorLike } from './to-html-types.ts';

describe('buildErrorHeader', () => {
  test('renders title, category text and an IDE link when linkable', () => {
    const html = buildErrorHeader({
      humanTitle: 'Boom',
      category: 'ERR_X',
      severity: 'error',
      phase: 'render',
      environment: 'development',
      verbosity: 'medium',
      displayPath: 'a.njk',
      displayLine: 3,
      displayCol: 5,
      ide: 'vscode',
      canLinkLocation: true,
      locDisplay: 'a.njk:3:5',
    });
    expect(html).toContain('error-header');
    expect(html).toContain('Boom');
    expect(html).toContain('ERR_X');
    expect(html).toContain('Render');
    expect(html).toContain('Development');
    expect(html).toContain('badge-dev');
    expect(html).toContain('loc-link');
    expect(html).toContain('vscode://file/');
  });

  test('omits the location block at simple verbosity', () => {
    const html = buildErrorHeader({
      humanTitle: 'Boom',
      category: 'ERR',
      severity: 'warning',
      phase: null,
      environment: null,
      verbosity: 'simple',
      displayPath: 'a.njk',
      displayLine: 1,
      displayCol: 1,
      ide: 'vscode',
      canLinkLocation: true,
      locDisplay: 'a.njk:1:1',
    });
    expect(html).not.toContain('error-location');
  });
});

describe('buildErrorFooter', () => {
  test('renders version and timestamp', () => {
    const html = buildErrorFooter({
      version: '1.2.3',
      timestamp: 'now',
      verbosity: 'medium',
      canLinkLocation: false,
      ide: 'vscode',
      displayPath: 'a.njk',
      displayLine: 1,
      displayCol: 1,
    });
    expect(html).toContain('Nunjucks 1.2.3');
    expect(html).toContain('now');
  });

  test('omits footer actions when location is not linkable', () => {
    const html = buildErrorFooter({
      version: '1.0',
      timestamp: undefined,
      verbosity: 'full',
      canLinkLocation: false,
      ide: 'vscode',
      displayPath: 'a.njk',
      displayLine: 1,
      displayCol: 1,
    });
    expect(html).not.toContain('error-footer-actions');
  });
});

describe('buildErrorBodyContent', () => {
  test('returns empty string for non-full verbosity', () => {
    const out = buildErrorBodyContent({
      verbosity: 'simple',
      error: {} as ErrorLike,
      classified: {} as ClassifiedError,
      sourceTrace: null,
      renderContext: undefined,
      ide: 'vscode',
      displayPath: 'a.njk',
    });
    expect(out).toBe('');
  });

  test('renders causes and suggested fix for full verbosity', () => {
    const classified: ClassifiedError = {
      category: 'ERR',
      undefinedName: null,
      title: 'T',
      causes: ['bad thing'],
      fixCode: 'x = 1',
      fixComment: '// fix',
      documentationUrl: null,
      severity: 'error',
    };
    const html = buildErrorBodyContent({
      verbosity: 'full',
      error: {} as ErrorLike,
      classified,
      sourceTrace: null,
      renderContext: undefined,
      ide: 'vscode',
      displayPath: 'a.njk',
    });
    expect(html).toContain('error-body');
    expect(html).toContain('Possible Causes');
    expect(html).toContain('bad thing');
    expect(html).toContain('Suggested Fix');
    expect(html).toContain('syntax-comment');
  });
});

describe('buildHtmlWrapper', () => {
  test('wraps header, body and footer into a labelled main element', () => {
    const html = buildHtmlWrapper('<header/>', '<body/>', '<footer/>');
    expect(html).toContain('error-wrapper');
    expect(html).toContain('aria-labelledby="err-title"');
    expect(html).toContain('<header/>');
    expect(html).toContain('<body/>');
    expect(html).toContain('<footer/>');
  });
});
