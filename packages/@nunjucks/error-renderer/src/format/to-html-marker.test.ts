import { describe, test, expect } from 'bun:test';
import { toHtmlMarker } from './to-html-marker.ts';
import type { ErrorLike } from '@nunjucks/error-catalog';

const MATCHED_UNDEFINED_VARIABLE = "Variable 'foo' is not defined";

describe('toHtmlMarker — structure', () => {
  test('emits the marker block, header and overlay with a generated id', () => {
    const markerError: ErrorLike = { message: MATCHED_UNDEFINED_VARIABLE };
    const markerHtml = toHtmlMarker(markerError);
    expect(markerHtml).toContain('nj-err-block');
    expect(markerHtml).toContain('nj-err-header');
    expect(markerHtml).toContain('nj-err-overlay');
    expect(markerHtml).toMatch(/data-nj-err-open="nj-err-[a-z0-9]{1,8}"/);
  });

  test('embeds the marker CSS once per block', () => {
    const markerError: ErrorLike = { message: MATCHED_UNDEFINED_VARIABLE };
    expect(toHtmlMarker(markerError)).toContain('.nj-err-block{');
  });

  test('includes the alert and close icon svgs', () => {
    const markerError: ErrorLike = { message: MATCHED_UNDEFINED_VARIABLE };
    const markerHtml = toHtmlMarker(markerError);
    expect(markerHtml).toContain('<svg');
    expect(markerHtml).toContain('nj-err-close');
  });
});

describe('toHtmlMarker — escaped title', () => {
  test('html-escapes <, > and & in the resolved title', () => {
    const specialCharError: ErrorLike = {
      message: "Variable '<x>&z' is not defined",
      templateName: 'tmpl.njk',
    };
    const markerHtml = toHtmlMarker(specialCharError);
    expect(markerHtml).toContain('&lt;x&gt;');
    expect(markerHtml).toContain('&amp;z');
  });
});

describe('toHtmlMarker — location link (canLink true)', () => {
  test('renders an anchor with a vscode link for a file path with line and col', () => {
    const fileLocationError: ErrorLike = {
      message: MATCHED_UNDEFINED_VARIABLE,
      templatePath: '/Users/bob/work/app/tmpl.njk',
      lineno: 2,
      colno: 3,
    };
    const markerHtml = toHtmlMarker(fileLocationError);
    expect(markerHtml).toContain('<a href="vscode://file/');
    expect(markerHtml).toContain('class="nj-err-loc-link"');
    expect(markerHtml).toContain('title="Open in VS Code"');
  });

  test('renders an anchor when only templateName is a file path', () => {
    const namedFileError: ErrorLike = {
      message: MATCHED_UNDEFINED_VARIABLE,
      templateName: 'memory',
    };
    const markerHtml = toHtmlMarker(namedFileError);
    expect(markerHtml).toContain('The error occurred in');
  });
});

describe('toHtmlMarker — location link (canLink false)', () => {
  test('renders a plain span (no anchor) for a non-file path', () => {
    const nonFileError: ErrorLike = {
      message: MATCHED_UNDEFINED_VARIABLE,
      templateName: 'memory:template',
    };
    const markerHtml = toHtmlMarker(nonFileError);
    expect(markerHtml).toContain('<span class="nj-err-loc-link">');
    expect(markerHtml).not.toContain('vscode://file/');
  });

  test('omits the location row entirely when no path is present', () => {
    const noLocationError: ErrorLike = { message: MATCHED_UNDEFINED_VARIABLE };
    const markerHtml = toHtmlMarker(noLocationError);
    expect(markerHtml).not.toContain('vscode://file/');
  });
});

describe('toHtmlMarker — iframe srcdoc escaping', () => {
  test('escapes closing tags so the srcdoc cannot break out of the script', () => {
    const markerError: ErrorLike = { message: MATCHED_UNDEFINED_VARIABLE };
    const markerHtml = toHtmlMarker(markerError);
    expect(markerHtml).toContain('<\\/');
    const srcdocLiteral = markerHtml.slice(
      markerHtml.indexOf('srcdoc='),
      markerHtml.indexOf(';o.appendChild(f)'),
    );
    expect(srcdocLiteral).not.toContain('</');
  });

  test('escapes double quotes inside the srcdoc JSON literal', () => {
    const markerError: ErrorLike = { message: MATCHED_UNDEFINED_VARIABLE };
    const markerHtml = toHtmlMarker(markerError);
    expect(markerHtml).toContain('srcdoc="<!DOCTYPE html>');
    expect(markerHtml).toMatch(/srcdoc="[^"]*\\"/);
  });
});
