#!/usr/bin/env bun
// WHY: dev-only typed audit tooling for route validation

import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { errorGroups } from '../lib/domain/error-route-metadata.ts';

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

const headless = process.argv.includes('--headless') || process.env.AUDIT_HEADLESS === '1';
const positionalBase = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
const rawBase = positionalBase ?? 'http://localhost:4000';
const BASE = rawBase.startsWith('http') ? rawBase : `http://${rawBase}`;

const discoverRoutes = async (base: string): Promise<string[]> => {
  try {
    // WHY: timeout guard — a hung server must fail the probe into the source-parse
    // fallback instead of blocking the audit script forever.
    const response = await fetch(`${base}/errors/`, { signal: AbortSignal.timeout(10_000) });
    if (response.ok) {
      const html = await response.text();
      const found = [...html.matchAll(/href="\/errors\/([a-z0-9-]+)"/gu)]
        .map((match) => match[1])
        .filter((s): s is string => s !== undefined);
      if (found.length) {
        return [...new Set(found)].sort((a, b) => a.localeCompare(b));
      }
    }
  } catch (probeError: unknown) {
    // WHY: a failed probe (server down, timeout, bad URL) is an expected degraded mode —
    // log it so a hung server stays diagnosable, then fall through to the registry.
    console.warn(`Route probe failed, falling back to the route registry: ${String(probeError)}`);
  }
  // WHY: the offline fallback reuses the same errorGroups registry that renders the
  // live /errors index page — regex-scraping routes/errors.ts used to silently miss the
  // data-driven routes registered from error-route-data.ts.
  return [...new Set(errorGroups.flatMap((group) => group.items.map((item) => item.path)))].sort(
    (a, b) => a.localeCompare(b)
  );
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
  // WHY: factory-time config errors (invalid-config, reserved filter/global names) throw
  // in nunjucks(config) before any template exists — the error page legitimately has no
  // template or caller location to point at, so there is nothing to cross-check.
  if (loc.path === 'unknown') {
    return { status: 'OK', reason: 'factory-time error (no template location by design)' };
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
    const word = (src.slice(loc.col - 1).match(/^[\w$]+/u) || [''])[0];
    // WHY: for JS-caller errors the caret must land on the template argument; landing on
    // the `render` identifier itself (immediately followed by the call paren) means the
    // reported location was mispointed at the call site instead of the argument.
    if (word === 'render' && src[loc.col - 1 + word.length] === '(') {
      return { status: 'MISMATCH', reason: 'caret on render( call, not template argument' };
    }
  }

  if ((caret?.carets ?? 0) > 0) {
    const lo = caret?.spaces ?? 0;
    const hi = (caret?.spaces ?? 0) + (caret?.carets ?? 0);
    const target = loc.col - 1;
    // WHY: NULL_VALUE pages ("Cannot access 'x' on undefined 'parent'") repoint the caret at
    // the null parent object via adjustColnoForNullValue (@nunjucks/error-formatter), so the
    // span legitimately ends on the '.' directly left of the access column instead of covering it.
    const coversAccessColumn = target >= lo - 1 && target <= hi;
    const coversNullParent =
      (info.title ?? '').startsWith("Cannot access '") && src[hi] === '.' && target === hi + 1;
    if (!coversAccessColumn && !coversNullParent) {
      return { status: 'SUSPECT', reason: `caret span [${lo},${hi}] misses col-1 ${target}` };
    }
  }

  return { status: 'OK', reason: '' };
};

const short = (p: string | null): string | null =>
  p ? p.replace(/^.*[/\\](samples[/\\].*)$/u, '$1').replaceAll(/\\/g, '/') : p;

const pad = (value: string | null | undefined, width: number): string =>
  String(value ?? '').padEnd(width);

const run = async (base: string): Promise<number> => {
  const routes = await discoverRoutes(base);
  const rows: RouteRow[] = (
    await Promise.all(
      routes.map(async (route): Promise<RouteRow> => {
        try {
          // WHY: timeout guard — a hung route surfaces as an ERROR row via the catch below,
          // never an indefinite stall of the whole Promise.all batch.
          const response = await fetch(`${base}/errors/${route}`, {
            signal: AbortSignal.timeout(10_000),
          });
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
          const validation = validate(route, info);
          return { route, status: validation.status, reason: validation.reason, info };
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
    )
  ).toSorted((a, b) => routes.indexOf(a.route) - routes.indexOf(b.route));

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

  const bad = rows.filter((row) => !['OK', 'NO_ERROR'].includes(row.status));
  const noErr = rows.filter((row) => row.status === 'NO_ERROR').length;
  console.log('-'.repeat(120));
  console.log(
    `Total: ${rows.length} | OK: ${rows.filter((row) => row.status === 'OK').length} | NO_ERROR: ${noErr} | Issues: ${bad.length}`
  );
  if (bad.length) {
    console.log('Issues:', bad.map((row) => `${row.route}(${row.status})`).join(', '));
  }
  return bad.length;
};

// WHY: every /errors route intentionally fails, so the app's error middleware logs a full ANSI
// dump per route — in headless mode those dumps only drown the audit table, so they are silenced.
const silenceConsoleError = <T>(operation: () => Promise<T>): Promise<T> => {
  const originalError = console.error;
  console.error = () => undefined;
  return operation().finally(() => {
    console.error = originalError;
  });
};

// WHY: CI has no dev server to point at — headless mode boots the express app in-process on an
// ephemeral loopback port, runs the same checks, closes the server, then exits with the
// found-issues count (0 = clean).
const runHeadless = async (): Promise<number> => {
  const { createApp } = await import('../app.ts');
  const server: Server = createServer(createApp());
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error(`Expected TCP address, received: ${String(address)}`);
  }
  try {
    return await silenceConsoleError(() => run(`http://127.0.0.1:${address.port}`));
  } finally {
    server.closeAllConnections();
    server.close();
    await once(server, 'close');
  }
};

const bootstrap = async (): Promise<void> => {
  if (headless) {
    const headlessIssueCount = await runHeadless();
    if (headlessIssueCount > 0) {
      process.exitCode = 1;
    }
    return;
  }
  const auditIssueCount = await run(BASE);
  if (auditIssueCount > 0) {
    process.exitCode = 1;
  }
};

bootstrap().catch((err: unknown) => {
  console.error(`audit-error-routes failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
