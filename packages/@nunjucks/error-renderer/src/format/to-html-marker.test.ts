import { describe, expect, test } from 'bun:test';
import type { ErrorLike } from '@nunjucks/error-catalog';
import { toHtmlMarker } from './to-html-marker.ts';

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

  // WHY: regression pin — data-nj-err-full feeds the overflow tooltip; the message
  // used to be escapeHtml'd first and escapeAttribute'd again, so the tooltip showed
  // literal entities. The attribute must be single-escaped from the RAW title.
  test('single-escapes the data-nj-err-full tooltip attribute from the raw title', () => {
    const hostile: ErrorLike = { message: '<b>&"x"' };
    const markerHtml = toHtmlMarker(hostile);
    expect(markerHtml).toContain('data-nj-err-full="&lt;b&gt;&amp;&quot;x&quot;"');
    expect(markerHtml).toContain('>&lt;b&gt;&amp;&quot;x&quot;</span>');
    expect(markerHtml).not.toContain('&amp;lt;');
    expect(markerHtml).not.toContain('&amp;quot;');
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
    expect(markerHtml).toContain('\\u003c/');
    const srcdocLiteral = markerHtml.slice(
      markerHtml.indexOf('srcdoc='),
      markerHtml.indexOf(';o.appendChild(f)')
    );
    expect(srcdocLiteral).not.toContain('</');
  });

  test('escapes double quotes inside the srcdoc JSON literal', () => {
    const markerError: ErrorLike = { message: MATCHED_UNDEFINED_VARIABLE };
    const markerHtml = toHtmlMarker(markerError);
    expect(markerHtml).toMatch(/srcdoc="[^"]*\\u003c!DOCTYPE[^"]*\\"/);
    expect(markerHtml).toMatch(/srcdoc="[^"]*\\"/);
  });
});

describe('toHtmlMarker — iframe hardening', () => {
  test('lazy iframe is created with sandbox="allow-scripts" in both variants', () => {
    // WHY: the dev error page ships its own toggle script, so allow-scripts is the
    // minimum viable sandbox; srcdoc frames are originless either way, denying
    // same-origin access to the host document while keeping the page interactive.
    const block = toHtmlMarker({ message: 'boom' });
    const inline = toHtmlMarker({ message: 'boom' }, { severity: 'inline' });
    expect(block).toContain(`f.setAttribute('sandbox','allow-scripts')`);
    expect(inline).toContain(`f.setAttribute('sandbox','allow-scripts')`);
    expect(block).not.toContain(`sandbox="allow-same-origin"`);
  });
});

describe('toHtmlMarker — script binds its own marker', () => {
  // WHY: regression pin — the script used to querySelector the FIRST
  // '[data-nj-err-open]' in the document, so with multiple markers every later
  // button opened the first marker's overlay (or never worked).
  const scriptOf = (html: string): string =>
    html.slice(html.indexOf('<script>'), html.indexOf('</script>'));
  const idOf = (html: string): string | undefined =>
    /data-nj-err-open="(nj-err-[a-z0-9]+)"/.exec(html)?.[1];

  test('each block marker script resolves its own button and overlay id', () => {
    const first = toHtmlMarker({ message: 'first error', templateName: 'a.njk' });
    const second = toHtmlMarker({ message: 'second error', templateName: 'b.njk' });
    const firstId = idOf(first);
    const secondId = idOf(second);
    expect(firstId).toBeDefined();
    expect(secondId).toBeDefined();
    expect(firstId).not.toBe(secondId);

    expect(scriptOf(first)).toContain(`[data-nj-err-open="${firstId}"]`);
    expect(scriptOf(first)).toContain(`getElementById('${firstId}')`);
    expect(scriptOf(first)).not.toContain(`"${secondId}"`);
    expect(scriptOf(second)).toContain(`[data-nj-err-open="${secondId}"]`);
    expect(scriptOf(second)).toContain(`getElementById('${secondId}'`);
    expect(scriptOf(second)).not.toContain(`"${firstId}"`);
  });

  test('each inline marker script resolves its own button and overlay id', () => {
    const first = toHtmlMarker({ message: 'first error' }, { severity: 'inline' });
    const second = toHtmlMarker({ message: 'second error' }, { severity: 'inline' });
    const firstId = idOf(first);
    const secondId = idOf(second);
    expect(firstId).not.toBe(secondId);
    expect(scriptOf(first)).not.toContain(`"${secondId}"`);
    expect(scriptOf(second)).not.toContain(`"${firstId}"`);
  });
});
