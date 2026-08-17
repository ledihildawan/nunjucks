import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isErr } from '@nunjucks/lib';
import { render } from './render.ts';
import { renderTemplate } from './render-test-helper.ts';

let tempDir: string;

const renderFile = async (
  filename: string,
  context: Record<string, unknown> = {},
  config: Record<string, unknown> = {}
) => {
  const result = await render(filename, { context, views: tempDir, ...config });
  if (isErr(result)) {
    throw result.error;
  }
  return result.value;
};

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'njk-test-'));
});

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('extends and blocks', () => {
  test('basic extends with block override', async () => {
    await Promise.all([
      writeFile(join(tempDir, 'base.njk'), 'Base{% block content %}default{% endblock %}'),
      writeFile(
        join(tempDir, 'child.njk'),
        '{% extends "base.njk" %}{% block content %}override{% endblock %}'
      ),
    ]);

    const result = await renderFile('child.njk', {});
    expect(result).toContain('override');
  });

  test('nested block renders in place exactly once (parentTemplate scope regression)', async () => {
    const result = await renderTemplate(
      'X{% block outer %}O{% block inner %}I{% endblock %}{% endblock %}Y'
    );
    expect(result).toBe('XOIY');
  });

  test('child non-block output is suppressed under extends (Jinja parity)', async () => {
    await Promise.all([
      writeFile(join(tempDir, 'sup-p.njk'), 'P-START{% block b %}P-B{% endblock %}P-END'),
      writeFile(
        join(tempDir, 'sup-child.njk'),
        'STRAY-TEXT{{ stray_expr }}{% extends "sup-p.njk" %}{% block b %}C-B{% endblock %}TRAILING'
      ),
    ]);
    const result = await renderFile('sup-child.njk', {});
    // WHY: text before the extends tag, output expressions, and trailing content are
    // all suppressed — the parent's delegation pass renders the page.
    expect(result).toBe('P-STARTC-BP-END');
  });

  test('3-level extends resolves ancestor blocks the direct parent omits', async () => {
    await Promise.all([
      writeFile(
        join(tempDir, 'gp.njk'),
        'G{% block one %}GP1{% endblock %}{% block two %}GP2{% endblock %}{% block footer %}GPF{% endblock %}'
      ),
      writeFile(
        join(tempDir, 'mid.njk'),
        '{% extends "gp.njk" %}{% block one %}MID1+{{ super() }}{% endblock %}'
      ),
      writeFile(
        join(tempDir, 'leaf.njk'),
        '{% extends "mid.njk" %}{% block one %}LEAF1+{{ super() }}{% endblock %}{% block footer %}LEAFF{% endblock %}'
      ),
    ]);

    const result = await renderFile('leaf.njk', {});
    expect(result).toBe('GLEAF1+MID1+GP1GP2LEAFF');
  });

  test('block captured into a buffer renders once under extends', async () => {
    await Promise.all([
      writeFile(join(tempDir, 'cap-p.njk'), 'PRE{% block b %}PB{% endblock %}POST'),
      writeFile(
        join(tempDir, 'cap-child.njk'),
        '{% extends "cap-p.njk" %}{% capture keep %}{% block b %}CHILD-B{% endblock %}{% endcapture %}[{{ keep }}]'
      ),
    ]);

    const result = await renderFile('cap-child.njk', {});
    // WHY: the block renders exactly once (the parent's hole) and the child's capture
    // stays empty; the child's literal "[]" text is suppressed under extends (the
    // parent's delegation pass renders the page — Jinja parity).
    expect(result).toBe('PRECHILD-BPOST');
  });

  test('block without extends uses default content', async () => {
    await writeFile(
      join(tempDir, 'only-block.njk'),
      'Before{% block main %}default content{% endblock %}After'
    );

    const result = await renderFile('only-block.njk', {});
    expect(result).toContain('default content');
  });

  test('child can access parent block via super', async () => {
    await Promise.all([
      writeFile(join(tempDir, 'super-base.njk'), 'Header{% block content %}Parent{% endblock %}'),
      writeFile(
        join(tempDir, 'super-child.njk'),
        '{% extends "super-base.njk" %}{% block content %}Child: {{ super() }}{% endblock %}'
      ),
    ]);

    const result = await renderFile('super-child.njk', {});
    expect(result).toContain('Child: Parent');
  });
});

describe('include', () => {
  test('include renders another template', async () => {
    await Promise.all([
      writeFile(join(tempDir, 'partial.njk'), 'Partial content'),
      writeFile(join(tempDir, 'main.njk'), 'Main:{% include "partial.njk" %}'),
    ]);

    const result = await renderFile('main.njk', {});
    expect(result).toContain('Partial content');
  });

  test('include with context passes variables', async () => {
    await Promise.all([
      writeFile(join(tempDir, 'with-context.njk'), 'Hello {{ name }}'),
      writeFile(join(tempDir, 'use-context.njk'), '{% include "with-context.njk" %}'),
    ]);

    const result = await renderFile('use-context.njk', { name: 'Alice' });
    expect(result).toContain('Hello Alice');
  });

  // WHY: regression — env.getTemplate returns null for a missing source when
  // ignoreMissing is set; the compiled include used to dereference it
  // unconditionally (TypeError: null is not an object).
  test('include ignore missing skips an absent template', async () => {
    await writeFile(join(tempDir, 'ignore-main.njk'), 'A{% include "absent.njk" ignore missing %}B');
    const result = await renderFile('ignore-main.njk', {});
    expect(result).toBe('AB');
  });

  test('include ignore missing still renders a present template', async () => {
    await writeFile(
      join(tempDir, 'ignore-present.njk'),
      'A{% include "partial.njk" ignore missing %}B'
    );
    const result = await renderFile('ignore-present.njk', {});
    expect(result).toBe('APartial contentB');
  });

  test('include ignore missing with context skips silently', async () => {
    await writeFile(
      join(tempDir, 'ignore-with.njk'),
      'A{% include "absent.njk" with name ignore missing %}B'
    );
    const result = await renderFile('ignore-with.njk', { name: 'Alice' });
    expect(result).toBe('AB');
  });

  test('include without ignore missing still raises FILE_NOT_FOUND', async () => {
    await writeFile(join(tempDir, 'missing-main.njk'), 'A{% include "absent.njk" %}B');
    await expect(renderFile('missing-main.njk', {})).rejects.toMatchObject({
      code: 'FILE_NOT_FOUND',
    });
  });
});

describe('components', () => {
  test('component definition and call', async () => {
    const result = await renderTemplate(
      `{% component hello(name) %}Hello {{ name }}!{% endcomponent %}
{{ hello("World") }}`
    );
    expect(result).toContain('Hello World!');
  });

  test('component with default arguments', async () => {
    const result = await renderTemplate(
      `{% component greet(name="Guest") %}Hi {{ name }}{% endcomponent %}
{{ greet() }}`
    );
    expect(result).toContain('Hi Guest');
  });

  test('component with multiple arguments', async () => {
    const result = await renderTemplate(
      `{% component add(a, b) %}{{ a + b }}{% endcomponent %}
{{ add(3, 5) }}`
    );
    expect(result).toContain('8');
  });

  test('component calling other component', async () => {
    const result = await renderTemplate(
      `{% component inner() %}inner{% endcomponent %}
{% component outer() %}{{ inner() }}-outer{% endcomponent %}
{{ outer() }}`
    );
    expect(result).toContain('inner-outer');
  });

  test('component with conditional logic', async () => {
    const result = await renderTemplate(
      `{% component score(n) %}
{% if n >= 90 %}A
{% elif n >= 80 %}B
{% else %}C{% endif %}
{% endcomponent %}
{{ score(85) }}`
    );
    expect(result).toContain('B');
  });

  test('component with for loop', async () => {
    const result = await renderTemplate(
      `{% component list(items) %}
{% for item in items %}{{ item }},{% endfor %}
{% endcomponent %}
{{ list(["a", "b", "c"]) }}`
    );
    expect(result).toContain('a,b,c,');
  });

  test('component with kwargs', async () => {
    const result = await renderTemplate(
      `{% component greet(name="World") %}Hello {{ name }}{% endcomponent %}
{{ greet(name="Alice") }}`
    );
    expect(result).toContain('Hello Alice');
  });

  test('component with partial kwargs', async () => {
    const result = await renderTemplate(
      `{% component format(name="Anonymous", greeting="Hello") %}{{ greeting }} {{ name }}{% endcomponent %}
{{ format(greeting="Hi") }}`
    );
    expect(result).toContain('Hi Anonymous');
  });
});

describe('import', () => {
  test('import component from another file', async () => {
    await Promise.all([
      writeFile(
        join(tempDir, 'components.njk'),
        `
{% component hello(name) %}Hello {{ name }}!{% endcomponent %}
{% component goodbye(name) %}Goodbye {{ name }}!{% endcomponent %}
`
      ),
      writeFile(
        join(tempDir, 'use-components.njk'),
        `
{% import "components.njk" as m %}
{{ m.hello("World") }}
`
      ),
    ]);

    const result = await renderFile('use-components.njk', {});
    expect(result).toContain('Hello World!');
  });
});

describe('from import', () => {
  test('from import brings components into scope directly', async () => {
    await Promise.all([
      writeFile(
        join(tempDir, 'my-components.njk'),
        `
{% component greet(name) %}Hi {{ name }}{% endcomponent %}
{% component farewell(name) %}Bye {{ name }}{% endcomponent %}
`
      ),
      writeFile(
        join(tempDir, 'use-from.njk'),
        `
{% from "my-components.njk" import greet %}
{{ greet("Alice") }}
`
      ),
    ]);

    const result = await renderFile('use-from.njk', {});
    expect(result).toContain('Hi Alice');
  });

  test('from import with multiple items', async () => {
    await Promise.all([
      writeFile(
        join(tempDir, 'math-components.njk'),
        `
{% component double(x) %}{{ x * 2 }}{% endcomponent %}
{% component triple(x) %}{{ x * 3 }}{% endcomponent %}
`
      ),
      writeFile(
        join(tempDir, 'use-multi-import.njk'),
        `
{% from "math-components.njk" import double, triple %}
double(5) = {{ double(5) }}, triple(5) = {{ triple(5) }}
`
      ),
    ]);

    const result = await renderFile('use-multi-import.njk', {});
    expect(result).toContain('double(5) = 10');
    expect(result).toContain('triple(5) = 15');
  });

  test('from import with alias', async () => {
    await Promise.all([
      writeFile(
        join(tempDir, 'utils.njk'),
        `
{% component greet(name) %}Hello {{ name }}{% endcomponent %}
`
      ),
      writeFile(
        join(tempDir, 'use-alias.njk'),
        `
{% from "utils.njk" import greet as say_hello %}
{{ say_hello("Bob") }}
`
      ),
    ]);

    const result = await renderFile('use-alias.njk', {});
    expect(result).toContain('Hello Bob');
  });

  test('from import with context', async () => {
    await Promise.all([
      writeFile(
        join(tempDir, 'ctx-components.njk'),
        `
{% component show_user() %}{{ user.name }}{% endcomponent %}
`
      ),
      writeFile(
        join(tempDir, 'use-ctx.njk'),
        `
{% from "ctx-components.njk" import show_user with context %}
{{ show_user() }}
`
      ),
    ]);

    const result = await renderFile('use-ctx.njk', { user: { name: 'Charlie' } });
    expect(result).toContain('Charlie');
  });

  test('from import throws when symbol not found', async () => {
    await Promise.all([
      writeFile(
        join(tempDir, 'partial-components.njk'),
        `
{% component foo() %}foo{% endcomponent %}
`
      ),
      writeFile(
        join(tempDir, 'use-missing.njk'),
        `
{% from "partial-components.njk" import missing_component %}
`
      ),
    ]);

    await expect(renderFile('use-missing.njk', {})).rejects.toThrow();
  });
});
