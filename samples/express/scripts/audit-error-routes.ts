#!/usr/bin/env bun
// WHY: dev-only typed audit tooling for route validation

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface ParsedLocation {
  path: string | null;
  line: number | null;
  col: number | null;
}

interface ParsedCaret {
  spaces: number;
  carets: number;
}

interface ParseResult {
  loc: ParsedLocation | null;
  caret: ParsedCaret | null;
  code: string | null;
  title: string | null;
}

interface ValidationResult {
  status: 'OK' | 'NO_ERROR' | 'MISMATCH' | 'SUSPECT' | 'ERROR';
  reason: string;
}

interface RouteInfo extends ParseResult {
  threw: boolean;
  hasErrorPage: boolean;
}

interface RouteRow {
  route: string;
  status: string;
  reason: string;
  info: RouteInfo;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rawBase = process.argv[2] ?? 'http://localhost:4000';
const BASE = rawBase.startsWith('http') ? rawBase : `http://${rawBase}`;
const ERRORS_TS = path.join(__dirname, '..', 'routes', 'errors.ts');

const discoverRoutes = async (base: string): Promise<string[]> => {
  try {
    const response = await fetch(`${base}/errors/`);
    if (response.ok) {
      const html = await response.text();
      const found = [...html.matchAll(/href="\/errors\/([a-z0-9-]+)"/gu)]
        .map((match) => match[1])
        .filter((s): s is string => s !== undefined);
      if (found.length) {
        return [...new Set(found)].sort((a, b) => a.localeCompare(b));
      }
    }
  } catch {
    // fallthrough to source parsing
  }
  const errorsSrc = readFileSync(ERRORS_TS, 'utf8');
  return [
    ...new Set(
      [...errorsSrc.matchAll(/router\.get\('\/([a-z0-9-]+)'/gu)]
        .map((m) => m[1])
        .filter((s): s is string => s !== undefined)
    ),
  ];
};

const decode = (input: string): string =>
  input
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&');

const parse = (html: string): ParseResult => {
  const link =
    html.match(/The error occurred in <a href="[a-z]+:\/\/file\/([^"]+)"/u) ||
    html.match(/error-location-text">([^<]+)</u);
  let loc: ParsedLocation | null = null;
  if (link) {
    const raw = decode(link[1] ?? '');
    const m = raw.match(/^(.*):(\d+):(\d+)$/u);
    if (m) {
      loc = { path: m[1] ?? null, line: Number(m[2]), col: Number(m[3]) };
    } else {
      loc = { path: raw, line: null, col: null };
    }
  }
  const caretMatch = html.match(/error-marker-content">([^<]*)</u);
  let caret: ParsedCaret | null = null;
  if (caretMatch) {
    const text = (caretMatch[1] ?? '').replaceAll('&nbsp;', ' ');
    const carets = text.replaceAll(/[^^]/g, '');
    caret = { spaces: text.length - carets.length, carets: carets.length };
  }
  const badge = html.match(/badge badge-error">([^<]+)</u);
  const title = html.match(/error-title">([^<]+)</u);
  return {
    loc,
    caret,
    code: badge ? decode(badge[1] ?? '') : null,
    title: title ? decode(title[1] ?? '').trim() : null,
  };
};

const sourceLine = (filePath: string | null, line: number | null): string | null => {
  if (!filePath || line == null || !existsSync(filePath)) {
    return null;
  }
  const lines = readFileSync(filePath, 'utf8').split('\n');
  return lines[line - 1] ?? null;
};

const validate = (_route: string, info: RouteInfo): ValidationResult => {
  const { loc, caret, threw } = info;

  if (!threw) {
    return info.hasErrorPage
      ? { status: 'OK', reason: '' }
      : { status: 'NO_ERROR', reason: 'route returned 200 (no error thrown)' };
  }

  if (!loc) {
    return { status: 'MISMATCH', reason: 'error page has no location block' };
  }
  if (!loc.path) {
    return { status: 'MISMATCH', reason: 'empty path' };
  }

  const isTs = /\.(ts|js|mjs|cjs)$/u.test(loc.path);
  const isTpl = /\.(njk|nunjucks|html|htm|tmpl|tpl)$/u.test(loc.path);
  const isInline = loc.path === 'inline';

  if ((isTs || isTpl) && !existsSync(loc.path)) {
    return { status: 'MISMATCH', reason: `path not found on disk: ${loc.path}` };
  }

  if (loc.line == null || loc.col == null) {
    return { status: 'MISMATCH', reason: 'missing line/col' };
  }

  if (isInline) {
    if ((caret?.carets ?? 0) > 0) {
      return { status: 'OK', reason: '' };
    }
    return { status: 'SUSPECT', reason: 'inline location without a caret' };
  }

  const src = sourceLine(loc.path, loc.line);
  if (src == null) {
    return { status: 'MISMATCH', reason: 'could not read source line' };
  }

  const underChar = src[loc.col - 1];

  if (loc.col < 1) {
    return { status: 'MISMATCH', reason: 'col<1 (fallback)' };
  }
  if (underChar == null) {
    return { status: 'MISMATCH', reason: `col ${loc.col} past end of line` };
  }
  if (/\s/u.test(underChar)) {
    return {
      status: 'MISMATCH',
      reason: `caret on whitespace (char=${JSON.stringify(underChar)})`,
    };
  }

  if (isTs) {
    const before = src.slice(0, loc.col - 1);
    const word = (src.slice(loc.col - 1).match(/^[\w$]+/u) || [''])[0];
    if (word === 'render' && /\brender$/u.test(before + word) === false) {
      const idx = src.indexOf('render(');
      if (idx >= 0 && loc.col - 1 === idx) {
        return { status: 'MISMATCH', reason: 'caret on render( call, not template argument' };
      }
    }
  }

  if ((caret?.carets ?? 0) > 0) {
    const lo = caret?.spaces ?? 0;
    const hi = (caret?.spaces ?? 0) + (caret?.carets ?? 0);
    const target = loc.col - 1;
    if (target < lo - 1 || target > hi) {
      return { status: 'SUSPECT', reason: `caret span [${lo},${hi}] misses col-1 ${target}` };
    }
  }

  return { status: 'OK', reason: '' };
};

const short = (p: string | null): string | null =>
  p ? p.replace(/^.*[/\\](samples[/\\].*)$/u, '$1').replaceAll(/\\/g, '/') : p;

const pad = (value: string | null | undefined, width: number): string =>
  String(value ?? '').padEnd(width);

const run = async (): Promise<void> => {
  const routes = await discoverRoutes(BASE);
  const rows: RouteRow[] = await Promise.all(
    routes.map(async (route): Promise<RouteRow> => {
      try {
        const response = await fetch(`${BASE}/errors/${route}`);
        const html = await response.text();
        const parsed = parse(html);
        const info: RouteInfo = {
          loc: parsed.loc,
          caret: parsed.caret,
          code: parsed.code,
          title: parsed.title,
          threw: response.status >= 400,
          hasErrorPage: /class="error-(?:wrapper|title|location)"/u.test(html),
        };
        const v = validate(route, info);
        return { route, status: v.status, reason: v.reason, info };
      } catch (err: unknown) {
        return {
          route,
          status: 'ERROR',
          reason: String(err),
          info: {
            loc: null,
            caret: null,
            code: null,
            title: null,
            threw: false,
            hasErrorPage: false,
          },
        };
      }
    })
  );

  rows.sort((a, b) => routes.indexOf(a.route) - routes.indexOf(b.route));

  console.log(`${pad('ROUTE', 26) + pad('STATUS', 11) + pad('LOCATION', 46)}CODE`);
  console.log('-'.repeat(120));
  console.log(
    rows
      .map((row) => {
        const loc = row.info.loc
          ? `${short(row.info.loc.path)}:${row.info.loc.line}:${row.info.loc.col}`
          : '(none)';
        const line =
          pad(row.route, 26) + pad(row.status, 11) + pad(loc, 46) + (row.info.code || '');
        return row.status !== 'OK' ? `${line}\n  └─ ${row.reason}` : line;
      })
      .join('\n')
  );

  const bad = rows.filter((r) => !['OK', 'NO_ERROR'].includes(r.status));
  const noErr = rows.filter((r) => r.status === 'NO_ERROR').length;
  console.log('-'.repeat(120));
  console.log(
    `Total: ${rows.length} | OK: ${rows.filter((r) => r.status === 'OK').length} | NO_ERROR: ${noErr} | Issues: ${bad.length}`
  );
  if (bad.length) {
    console.log('Issues:', bad.map((r) => `${r.route}(${r.status})`).join(', '));
    process.exitCode = 1;
  }
};

run().catch((err: unknown) => {
  console.error(`audit-error-routes failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
