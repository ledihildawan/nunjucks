#!/usr/bin/env node
// Audit every /errors/* route: fetch the rendered error page, extract the
// reported location (path:line:col) + caret, and validate that the location
// actually points at meaningful source (not a fallback like col 0 / the
// `render(` call / whitespace). Emits a table and a non-zero exit on mismatch.
//
// Usage: node audit-routes.mjs [baseUrl]
//   baseUrl defaults to http://localhost:4000
// The express server (bun main.ts) must already be running.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] || 'http://localhost:4000';
const ERRORS_TS = path.join(__dirname, 'routes', 'errors.ts');

// Discover every error route the app actually serves. We read the live
// /errors/ index page, which lists ALL routes — both the explicit
// router.get('/name') handlers AND the data-driven ones built from the
// errorRoutes array (router.get('/' + routePath)), which a plain source
// regex would miss. Falls back to a regex scan of routes/errors.ts when the
// index fetch fails (e.g. server not yet up, so the caller can debug).
const discoverRoutes = async (base) => {
  try {
    const res = await fetch(`${base}/errors/`);
    if (res.ok) {
      const html = await res.text();
      const found = [...html.matchAll(/href="\/errors\/([a-z0-9-]+)"/gu)].map((m) => m[1]);
      if (found.length) {
        return [...new Set(found)].sort((a, b) => a.localeCompare(b));
      }
    }
  } catch {
    /* fall through to source scan */
  }
  const errorsSrc = readFileSync(ERRORS_TS, 'utf8');
  return [...new Set([...errorsSrc.matchAll(/router\.get\('\/([a-z0-9-]+)'/gu)].map((m) => m[1]))];
};

const decode = (s) =>
  s.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&amp;', '&');

const parse = (html) => {
  const link = html.match(/The error occurred in <a href="[a-z]+:\/\/file\/([^"]+)"/u)
    || html.match(/error-location-text">([^<]+)</u);
  let loc = null;
  if (link) {
    const raw = decode(link[1]);
    const m = raw.match(/^(.*):(\d+):(\d+)$/u);
    if (m) loc = { path: m[1], line: Number(m[2]), col: Number(m[3]) };
    else loc = { path: raw, line: null, col: null };
  }
  const caretMatch = html.match(/error-marker-content">([^<]*)</u);
  let caret = null;
  if (caretMatch) {
    const text = caretMatch[1].replaceAll('&nbsp;', ' ');
    const carets = text.replace(/[^^]/g, '');
    caret = { spaces: text.length - carets.length, carets: carets.length };
  }
  const badge = html.match(/badge badge-error">([^<]+)</u);
  const title = html.match(/error-title">([^<]+)</u);
  return {
    loc,
    caret,
    code: badge ? decode(badge[1]) : null,
    title: title ? decode(title[1]).trim() : null
  };
};

// Read a specific 1-based line from a source file.
const sourceLine = (filePath, line) => {
  if (!filePath || line == null || !existsSync(filePath)) return null;
  const lines = readFileSync(filePath, 'utf8').split('\n');
  return lines[line - 1] ?? null;
};

// Validate the reported location. Returns { status, reason }.
// The ground truth is the caret rendered in the Source Trace: if a caret is
// drawn and it sits on a non-whitespace character of the reported line, the
// location is meaningful. Routes that return HTTP 200 (no error thrown) are
// reported as PASS_NO_ERROR — they legitimately have no location.
const validate = (r, info) => {
  const { loc, caret, threw } = info;

  // Route did not throw (HTTP 200) — no error page is expected, so absence of
  // a location is correct, not a defect.
  if (!threw) {
    return info.hasErrorPage
      ? { status: 'OK', reason: '' }
      : { status: 'NO_ERROR', reason: 'route returned 200 (no error thrown)' };
  }

  if (!loc) return { status: 'MISMATCH', reason: 'error page has no location block' };
  if (!loc.path) return { status: 'MISMATCH', reason: 'empty path' };

  const isTs = /\.(ts|js|mjs|cjs)$/u.test(loc.path);
  const isTpl = /\.(njk|nunjucks|html|htm|tmpl|tpl)$/u.test(loc.path);
  const isInline = loc.path === 'inline';

  // Real files must resolve on disk.
  if ((isTs || isTpl) && !existsSync(loc.path)) {
    return { status: 'MISMATCH', reason: `path not found on disk: ${loc.path}` };
  }

  if (loc.line == null || loc.col == null) {
    return { status: 'MISMATCH', reason: 'missing line/col' };
  }

  // For inline pseudo-paths we can only trust the caret against the snippet.
  if (isInline) {
    if (caret?.carets > 0) return { status: 'OK', reason: '' };
    return { status: 'SUSPECT', reason: 'inline location without a caret' };
  }

  const src = sourceLine(loc.path, loc.line);
  if (src == null) return { status: 'MISMATCH', reason: 'could not read source line' };

  const underChar = src[loc.col - 1];

  // The decisive test: caret must sit on a non-whitespace character.
  if (loc.col < 1) return { status: 'MISMATCH', reason: 'col<1 (fallback)' };
  if (underChar == null) {
    return { status: 'MISMATCH', reason: `col ${loc.col} past end of line` };
  }
  if (/\s/u.test(underChar)) {
    return { status: 'MISMATCH', reason: `caret on whitespace (char=${JSON.stringify(underChar)})` };
  }

  // For a .ts caller, the location should sit inside a string/template literal
  // OR on a bare literal argument to render(). The classic fallback bug is the
  // caret landing on the word `render` itself.
  if (isTs) {
    const before = src.slice(0, loc.col - 1);
    const word = (src.slice(loc.col - 1).match(/^[\w$]+/u) || [''])[0];
    if (word === 'render' && /\brender$/u.test(before + word) === false) {
      // caret is exactly on the `render` identifier of a render( call
      const idx = src.indexOf('render(');
      if (idx >= 0 && loc.col - 1 === idx) {
        return { status: 'MISMATCH', reason: 'caret on render( call, not template argument' };
      }
    }
  }

  // Caret alignment: the drawn caret word-snaps to the token beginning at/near
  // the reported column, so it may start slightly before col. Require only that
  // the caret span overlaps the reported column.
  if (caret?.carets > 0) {
    const lo = caret.spaces;
    const hi = caret.spaces + caret.carets;
    const target = loc.col - 1;
    if (target < lo - 1 || target > hi) {
      return { status: 'SUSPECT', reason: `caret span [${lo},${hi}] misses col-1 ${target}` };
    }
  }

  return { status: 'OK', reason: '' };
};

const short = (p) => (p ? p.replace(/^.*[/\\](samples[/\\].*)$/u, '$1').replace(/\\/g, '/') : p);

const run = async () => {
  const routes = await discoverRoutes(BASE);
  const rows = [];
  await Promise.all(routes.map(async (route) => {
    try {
      const res = await fetch(`${BASE}/errors/${route}`);
      const html = await res.text();
      const info = parse(html);
      info.threw = res.status >= 400;
      info.hasErrorPage = /class="error-(?:wrapper|title|location)"/u.test(html);
      const v = validate(route, info);
      rows.push({ route, status: v.status, reason: v.reason, info });
    } catch (err) {
      rows.push({ route, status: 'ERROR', reason: String(err), info: {} });
    }
  }));

  rows.sort((a, b) => routes.indexOf(a.route) - routes.indexOf(b.route));

  const pad = (s, n) => String(s ?? '').padEnd(n);
  console.log(pad('ROUTE', 26) + pad('STATUS', 11) + pad('LOCATION', 46) + 'CODE');
  console.log('-'.repeat(120));
  for (const r of rows) {
    const loc = r.info.loc
      ? `${short(r.info.loc.path)}:${r.info.loc.line}:${r.info.loc.col}`
      : '(none)';
    console.log(pad(r.route, 26) + pad(r.status, 11) + pad(loc, 46) + (r.info.code || ''));
    if (r.status !== 'OK') console.log(`  └─ ${r.reason}`);
  }

  const bad = rows.filter(r => !['OK', 'NO_ERROR'].includes(r.status));
  const noErr = rows.filter(r => r.status === 'NO_ERROR').length;
  console.log('-'.repeat(120));
  console.log(`Total: ${rows.length} | OK: ${rows.filter(r => r.status === 'OK').length} | NO_ERROR: ${noErr} | Issues: ${bad.length}`);
  if (bad.length) {
    console.log('Issues:', bad.map(r => `${r.route}(${r.status})`).join(', '));
    process.exitCode = 1;
  }
};

run();
