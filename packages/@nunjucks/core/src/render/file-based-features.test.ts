import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { render } from './render.ts';
import { isErr } from '@nunjucks/lib';
import { renderTemplate } from './render-test-helper.ts';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tempDir: string;

const renderFile = async (filename: string, context: Record<string, unknown> = {}, config: Record<string, unknown> = {}) => {
  const result = await render(filename, { context, views: tempDir, ...config });
  if (isErr(result)) { throw result.error; }
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
    await writeFile(join(tempDir, 'base.njk'), 'Base{% block content %}default{% endblock %}');
    await writeFile(join(tempDir, 'child.njk'), '{% extends "base.njk" %}{% block content %}override{% endblock %}');

    const result = await renderFile('child.njk', {});
    expect(result).toContain('override');
  });

  test('block without extends uses default content', async () => {
    await writeFile(join(tempDir, 'only-block.njk'), 'Before{% block main %}default content{% endblock %}After');

    const result = await renderFile('only-block.njk', {});
    expect(result).toContain('default content');
  });

  test('child can access parent block via super', async () => {
    await writeFile(join(tempDir, 'super-base.njk'), 'Header{% block content %}Parent{% endblock %}');
    await writeFile(join(tempDir, 'super-child.njk'), '{% extends "super-base.njk" %}{% block content %}Child: {{ super() }}{% endblock %}');

    const result = await renderFile('super-child.njk', {});
    expect(result).toContain('Child: Parent');
  });
});

describe('include', () => {
  test('include renders another template', async () => {
    await writeFile(join(tempDir, 'partial.njk'), 'Partial content');
    await writeFile(join(tempDir, 'main.njk'), 'Main:{% include "partial.njk" %}');

    const result = await renderFile('main.njk', {});
    expect(result).toContain('Partial content');
  });

  test('include with context passes variables', async () => {
    await writeFile(join(tempDir, 'with-context.njk'), 'Hello {{ name }}');
    await writeFile(join(tempDir, 'use-context.njk'), '{% include "with-context.njk" %}');

    const result = await renderFile('use-context.njk', { name: 'Alice' });
    expect(result).toContain('Hello Alice');
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
    await writeFile(join(tempDir, 'components.njk'), `
{% component hello(name) %}Hello {{ name }}!{% endcomponent %}
{% component goodbye(name) %}Goodbye {{ name }}!{% endcomponent %}
`);
    await writeFile(join(tempDir, 'use-components.njk'), `
{% import "components.njk" as m %}
{{ m.hello("World") }}
`);

    const result = await renderFile('use-components.njk', {});
    expect(result).toContain('Hello World!');
  });
});

describe('from import', () => {
  test('from import brings components into scope directly', async () => {
    await writeFile(join(tempDir, 'my-components.njk'), `
{% component greet(name) %}Hi {{ name }}{% endcomponent %}
{% component farewell(name) %}Bye {{ name }}{% endcomponent %}
`);
    await writeFile(join(tempDir, 'use-from.njk'), `
{% from "my-components.njk" import greet %}
{{ greet("Alice") }}
`);

    const result = await renderFile('use-from.njk', {});
    expect(result).toContain('Hi Alice');
  });

  test('from import with multiple items', async () => {
    await writeFile(join(tempDir, 'math-components.njk'), `
{% component double(x) %}{{ x * 2 }}{% endcomponent %}
{% component triple(x) %}{{ x * 3 }}{% endcomponent %}
`);
    await writeFile(join(tempDir, 'use-multi-import.njk'), `
{% from "math-components.njk" import double, triple %}
double(5) = {{ double(5) }}, triple(5) = {{ triple(5) }}
`);

    const result = await renderFile('use-multi-import.njk', {});
    expect(result).toContain('double(5) = 10');
    expect(result).toContain('triple(5) = 15');
  });

  test('from import with alias', async () => {
    await writeFile(join(tempDir, 'utils.njk'), `
{% component greet(name) %}Hello {{ name }}{% endcomponent %}
`);
    await writeFile(join(tempDir, 'use-alias.njk'), `
{% from "utils.njk" import greet as say_hello %}
{{ say_hello("Bob") }}
`);

    const result = await renderFile('use-alias.njk', {});
    expect(result).toContain('Hello Bob');
  });

  test('from import with context', async () => {
    await writeFile(join(tempDir, 'ctx-components.njk'), `
{% component show_user() %}{{ user.name }}{% endcomponent %}
`);
    await writeFile(join(tempDir, 'use-ctx.njk'), `
{% from "ctx-components.njk" import show_user with context %}
{{ show_user() }}
`);

    const result = await renderFile('use-ctx.njk', { user: { name: 'Charlie' } });
    expect(result).toContain('Charlie');
  });

  test('from import throws when symbol not found', async () => {
    await writeFile(join(tempDir, 'partial-components.njk'), `
{% component foo() %}foo{% endcomponent %}
`);
    await writeFile(join(tempDir, 'use-missing.njk'), `
{% from "partial-components.njk" import missing_component %}
`);

    await expect(renderFile('use-missing.njk', {})).rejects.toThrow();
  });
});

describe('switch case default', () => {
  test('basic switch case', async () => {
    const result = await renderTemplate(
      '{% switch x %}{% case 1 %}one{% case 2 %}two{% case 3 %}three{% default %}other{% endswitch %}',
      { x: 2 }
    );
    expect(result).toBe('two');
  });

  test('switch with default case', async () => {
    const result = await renderTemplate(
      '{% switch x %}{% case 1 %}one{% case 2 %}two{% default %}default{% endswitch %}',
      { x: 99 }
    );
    expect(result).toBe('default');
  });

  test('switch falls through empty cases', async () => {
    const result = await renderTemplate(
      '{% switch x %}{% case 1 %}{% case 2 %}first or second{% default %}other{% endswitch %}',
      { x: 1 }
    );
    expect(result).toBe('first or second');
  });

  test('switch with expression in case', async () => {
    const result = await renderTemplate(
      '{% switch x %}{% case 5 + 5 %}ten{% case 20 / 2 %}also ten{% default %}other{% endswitch %}',
      { x: 10 }
    );
    expect(result).toBe('ten');
  });

  test('switch without matching case returns empty', async () => {
    const result = await renderTemplate(
      '{% switch x %}{% case 1 %}one{% case 2 %}two{% endswitch %}',
      { x: 999 }
    );
    expect(result).toBe('');
  });
});