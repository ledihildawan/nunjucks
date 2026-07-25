import { describe, test, expect } from 'bun:test';
import { 
  config,
  pipe,
  withViews,
  withGlobal,
  withGlobals,
  withFilter,
  withFilters,
  withSandbox,
  withCache,
  withAutoescape,
} from './index.ts';
import type { RenderConfig } from '../core/render.ts';

describe('composable HOF API', () => {
  describe('config() builder', () => {
    test('creates empty config when no functions provided', () => {
      const cfg = config();
      expect(cfg).toEqual({});
    });

    test('applies single function', () => {
      const cfg = config(withViews('./views'));
      expect(cfg.views).toBe('./views');
    });

    test('applies multiple functions in order', () => {
      const cfg = config(
        withViews('./views'),
        withGlobal('appName', 'My App'),
        withCache(true),
      );
      expect(cfg.views).toBe('./views');
      expect(cfg.globals).toEqual({ appName: 'My App' });
      expect(cfg.cache).toBe(true);
    });
  });

  describe('withViews()', () => {
    test('sets single view path', () => {
      const cfg = pipe({}, withViews('./views')) as RenderConfig;
      expect(cfg.views).toBe('./views');
    });

    test('sets multiple view paths', () => {
      const cfg = pipe({}, withViews(['./views', './layouts'])) as RenderConfig;
      expect(cfg.views).toEqual(['./views', './layouts']);
    });
  });

  describe('withGlobal()', () => {
    test('adds single global', () => {
      const cfg = pipe({}, withGlobal('appName', 'My App')) as RenderConfig;
      expect(cfg.globals).toEqual({ appName: 'My App' });
    });

    test('merges multiple globals', () => {
      const cfg = pipe(
        {},
        withGlobal('a', 1),
        withGlobal('b', 2),
      ) as RenderConfig;
      expect(cfg.globals).toEqual({ a: 1, b: 2 });
    });

    test('overrides existing global with same name', () => {
      const cfg = pipe(
        {},
        withGlobal('app', 'v1'),
        withGlobal('app', 'v2'),
      ) as RenderConfig;
      expect(cfg.globals).toEqual({ app: 'v2' });
    });
  });

  describe('withGlobals()', () => {
    test('adds multiple globals at once', () => {
      const cfg = pipe({}, withGlobals({ a: 1, b: 2 })) as RenderConfig;
      expect(cfg.globals).toEqual({ a: 1, b: 2 });
    });
  });

  describe('withFilter()', () => {
    test('adds filter without kwargs', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cfg = config(withFilter('upper', ((s: string) => s.toUpperCase()) as (...args: unknown[]) => unknown)) as any;
      expect(typeof cfg.filters?.upper).toBe('function');
    });

    test('filter without kwargs strips extra args', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cfg = config(withFilter('upper', ((s: string) => s.toUpperCase()) as (...args: unknown[]) => unknown)) as any;
      const filterFn = cfg.filters?.upper;
      const result = await filterFn('hello', 'extra_arg', { kwargs: true });
      expect(result).toBe('HELLO');
    });

    test('filter with kwargs passes all args', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cfg = config(
        withFilter('paginate', ((items: unknown[], kwargs: { count?: number } = {}) => {
          const count = kwargs.count ?? 10;
          return (items as unknown[]).slice(0, count);
        }) as (...args: unknown[]) => unknown),
      ) as any;
      const filterFn = cfg.filters?.paginate;
      const items = [1, 2, 3, 4, 5];
      const result = await filterFn(items, { count: 2 });
      expect(result).toEqual([1, 2]);
    });

    test('filter with destructured kwargs', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cfg = config(
        withFilter('format', ((value: unknown, { prefix = '', suffix = '' }: { prefix?: string; suffix?: string } = {}) => {
          return `${prefix}${value}${suffix}`;
        }) as (...args: unknown[]) => unknown),
      ) as any;
      const filterFn = cfg.filters?.format;
      const result = await filterFn('test', { prefix: '>>', suffix: '<<' });
      expect(result).toBe('>>test<<');
    });
  });

  describe('withFilters()', () => {
    test('adds multiple filters at once', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cfg = config(
        withFilters({
          upper: ((s: string) => s.toUpperCase()) as (...args: unknown[]) => unknown,
          lower: ((s: string) => s.toLowerCase()) as (...args: unknown[]) => unknown,
        }),
      ) as any;
      expect(typeof cfg.filters?.upper).toBe('function');
      expect(typeof cfg.filters?.lower).toBe('function');
    });
  });

  describe('withSandbox()', () => {
    test('enables sandbox with defaults', () => {
      const cfg = pipe({}, withSandbox()) as RenderConfig;
      expect(cfg.sandbox).toBe(true);
      expect(cfg.sandboxAllowlist).toEqual([]);
      expect(cfg.sandboxMode).toBe('blocklist');
    });

    test('enables sandbox with custom allowlist', () => {
      const cfg = pipe({}, withSandbox({ allowlist: ['fetch', 'Math'] })) as RenderConfig;
      expect(cfg.sandbox).toBe(true);
      expect(cfg.sandboxAllowlist).toEqual(['fetch', 'Math']);
    });

    test('sets blocklistMode correctly', () => {
      const cfg1 = pipe({}, withSandbox({ blocklistMode: true })) as RenderConfig;
      expect(cfg1.sandboxMode).toBe('blocklist');

      const cfg2 = pipe({}, withSandbox({ blocklistMode: false })) as RenderConfig;
      expect(cfg2.sandboxMode).toBe('allowlist');
    });
  });

  describe('withCache()', () => {
    test('enables cache by default', () => {
      const cfg = pipe({}, withCache()) as RenderConfig;
      expect(cfg.cache).toBe(true);
    });

    test('can disable cache', () => {
      const cfg = pipe({}, withCache(false)) as RenderConfig;
      expect(cfg.cache).toBe(false);
    });
  });

  describe('withAutoescape()', () => {
    test('enables autoescape by default', () => {
      const cfg = pipe({}, withAutoescape()) as RenderConfig;
      expect(cfg.autoescape).toBe(true);
    });

    test('can disable autoescape', () => {
      const cfg = pipe({}, withAutoescape(false)) as RenderConfig;
      expect(cfg.autoescape).toBe(false);
    });
  });

  describe('complex config building', () => {
    test('builds complete config with all options', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cfg = config(
        withViews('./views'),
        withGlobals({ appName: 'My App', version: '1.0' }),
        withFilters({
          upper: ((s: string) => s.toUpperCase()) as (...args: unknown[]) => unknown,
          currency: ((v: number) => `Rp ${v}`) as (...args: unknown[]) => unknown,
        }),
        withSandbox({ allowlist: ['fetch'] }),
        withCache(true),
        withAutoescape(true),
      ) as any;

      expect(cfg.views).toBe('./views');
      expect(cfg.globals).toEqual({ appName: 'My App', version: '1.0' });
      expect(cfg.filters?.upper).toBeDefined();
      expect(cfg.filters?.currency).toBeDefined();
      expect(cfg.sandbox).toBe(true);
      expect(cfg.sandboxAllowlist).toEqual(['fetch']);
      expect(cfg.cache).toBe(true);
      expect(cfg.autoescape).toBe(true);
    });
  });
});
