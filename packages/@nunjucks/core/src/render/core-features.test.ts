import { describe, expect, test } from 'bun:test';
import { renderTemplate } from './render-test-helper.ts';

describe('loop variables', () => {
  test('loop.index starts at 1', async () => {
    const result = await renderTemplate('{% for i in [1,2,3] %}{{ loop.index }}{% endfor %}', {});
    expect(result).toBe('123');
  });

  test('loop.index0 starts at 0', async () => {
    const result = await renderTemplate('{% for i in [1,2,3] %}{{ loop.index0 }}{% endfor %}', {});
    expect(result).toBe('012');
  });

  test('loop.first is true only on first iteration', async () => {
    const result = await renderTemplate('{% for i in [1,2,3] %}{{ loop.first }}{% endfor %}', {});
    expect(result).toBe('truefalsefalse');
  });

  test('loop.last is true only on last iteration', async () => {
    const result = await renderTemplate('{% for i in [1,2,3] %}{{ loop.last }}{% endfor %}', {});
    expect(result).toBe('falsefalsetrue');
  });

  test('loop.length returns array length', async () => {
    const result = await renderTemplate('{% for i in [1,2,3] %}{{ loop.length }}{% endfor %}', {});
    expect(result).toBe('333');
  });

  test('loop.revindex counts down from length', async () => {
    const result = await renderTemplate(
      '{% for i in [1,2,3] %}{{ loop.revindex }}{% endfor %}',
      {}
    );
    expect(result).toBe('321');
  });

  test('loop.revindex0 counts down from length-1', async () => {
    const result = await renderTemplate(
      '{% for i in [1,2,3] %}{{ loop.revindex0 }}{% endfor %}',
      {}
    );
    expect(result).toBe('210');
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

describe('scope block', () => {
  test('scope creates isolated variables', async () => {
    const result = await renderTemplate(
      '{{ x := 1 }}{% scope %}{{ x := 2 }}{% endscope %}{{ x }}',
      {}
    );
    expect(result).toBe('1');
  });

  test('scope inline assignment form', async () => {
    const result = await renderTemplate('{% scope x = 42 %}{{ x }}{% endscope %}', {});
    expect(result).toBe('42');
  });

  test('scope inline with multiple variables', async () => {
    const result = await renderTemplate('{% scope a = 1, b = 2 %}{{ a + b }}{% endscope %}', {});
    expect(result).toBe('3');
  });

  test('scope can read parent variables', async () => {
    const result = await renderTemplate('{{ x := "parent" }}{% scope %}{{ x }}{% endscope %}', {});
    expect(result).toBe('parent');
  });

  test('scope nested inside for loop', async () => {
    const result = await renderTemplate(
      '{% for i in [1, 2] %}{% scope x = i * 10 %}{{ x }}{% endscope %}{% endfor %}',
      {}
    );
    expect(result).toBe('1020');
  });
});

describe('conditional operators', () => {
  test('ternary operator true branch', async () => {
    const result = await renderTemplate('{{ true ? "yes" : "no" }}', {});
    expect(result).toBe('yes');
  });

  test('ternary operator false branch', async () => {
    const result = await renderTemplate('{{ false ? "yes" : "no" }}', {});
    expect(result).toBe('no');
  });

  test('nullish coalescing with undefined', async () => {
    const result = await renderTemplate('{{ foo ?? "default" }}', {});
    expect(result).toBe('default');
  });

  test('nullish coalescing with value', async () => {
    const result = await renderTemplate('{{ foo ?? "default" }}', { foo: 'hello' });
    expect(result).toBe('hello');
  });

  test('nullish coalescing with null', async () => {
    const result = await renderTemplate('{{ foo ?? "default" }}', { foo: null });
    expect(result).toBe('default');
  });

  test('optional chaining safe access', async () => {
    const result = await renderTemplate('{{ foo?.bar }}', { foo: { bar: 'hello' } });
    expect(result).toBe('hello');
  });

  test('optional chaining with null', async () => {
    const result = await renderTemplate('{{ foo?.bar }}', { foo: null });
    expect(result).toBe('');
  });

  test('optional chaining with undefined property', async () => {
    const result = await renderTemplate('{{ foo?.nonexistent }}', { foo: { bar: 'hello' } });
    expect(result).toBe('');
  });
});

describe('compound assignment in expressions', () => {
  test('+= adds and reassigns', async () => {
    const result = await renderTemplate('{{ x += 3 }}', { x: 5 });
    expect(result).toBe('8');
  });

  test('-= subtracts and reassigns', async () => {
    const result = await renderTemplate('{{ x -= 3 }}', { x: 10 });
    expect(result).toBe('7');
  });

  test('*= multiplies and reassigns', async () => {
    const result = await renderTemplate('{{ x *= 3 }}', { x: 4 });
    expect(result).toBe('12');
  });

  test('/= divides and reassigns', async () => {
    const result = await renderTemplate('{{ x /= 2 }}', { x: 8 });
    expect(result).toBe('4');
  });

  test('%= modulos and reassigns', async () => {
    const result = await renderTemplate('{{ x %= 3 }}', { x: 7 });
    expect(result).toBe('1');
  });

  test('**= exponentiates and reassigns', async () => {
    const result = await renderTemplate('{{ x **= 3 }}', { x: 2 });
    expect(result).toBe('8');
  });

  test('//= floor divides and reassigns', async () => {
    const result = await renderTemplate('{{ x //= 2 }}', { x: 7 });
    expect(result).toBe('3');
  });

  test('||= keeps truthy value', async () => {
    const result = await renderTemplate('{{ x ||= 9 }}', { x: 5 });
    expect(result).toBe('5');
  });

  test('||= assigns when falsy', async () => {
    const result = await renderTemplate('{{ x ||= 9 }}', { x: 0 });
    expect(result).toBe('9');
  });

  test('&&= assigns when truthy', async () => {
    const result = await renderTemplate('{{ x &&= 9 }}', { x: 5 });
    expect(result).toBe('9');
  });

  test('??= assigns when nullish', async () => {
    const result = await renderTemplate('{{ x ??= 9 }}', { x: null });
    expect(result).toBe('9');
  });
});

describe('prefix and postfix operators', () => {
  test('prefix increment', async () => {
    const result = await renderTemplate('{{ ++x }}', { x: 5 });
    expect(result).toBe('6');
  });

  test('prefix decrement', async () => {
    const result = await renderTemplate('{{ --x }}', { x: 5 });
    expect(result).toBe('4');
  });

  test('postfix increment', async () => {
    const result = await renderTemplate('{{ x++ }}', { x: 5 });
    expect(result).toBe('5');
  });

  test('postfix decrement', async () => {
    const result = await renderTemplate('{{ x-- }}', { x: 5 });
    expect(result).toBe('5');
  });

  test('chained increment/decrement', async () => {
    const result = await renderTemplate('{{ ++x }}-{{ x++ }}-{{ --x }}-{{ x-- }}', { x: 2 });
    expect(result).toBe('3-3-3-3');
  });
});

describe('object iteration', () => {
  test('for k,v in object', async () => {
    const result = await renderTemplate('{% for k, v in items %}{{ k }}={{ v }};{% endfor %}', {
      items: { a: 1, b: 2 },
    });
    expect(result).toBe('a=1;b=2;');
  });
  test('for k,v with loop.index', async () => {
    const result = await renderTemplate(
      '{% for k, v in items %}{{ loop.index }}:{{ k }};{% endfor %}',
      { items: { x: 10 } }
    );
    expect(result).toBe('1:x;');
  });
});

describe('for-else', () => {
  test('else fires on empty array', async () => {
    const result = await renderTemplate('{% for x in items %}{{ x }}{% else %}empty{% endfor %}', {
      items: [],
    });
    expect(result).toBe('empty');
  });
  test('else does not fire on non-empty array', async () => {
    const result = await renderTemplate('{% for x in items %}{{ x }}{% else %}empty{% endfor %}', {
      items: [1, 2],
    });
    expect(result).toBe('12');
  });
  test('else fires on undefined variable', async () => {
    const result = await renderTemplate(
      '{% for x in missing %}{{ x }}{% else %}empty{% endfor %}',
      {}
    );
    expect(result).toBe('empty');
  });
  test('else fires on null', async () => {
    const result = await renderTemplate('{% for x in items %}{{ x }}{% else %}empty{% endfor %}', {
      items: null,
    });
    expect(result).toBe('empty');
  });
  test('else fires on empty object', async () => {
    const result = await renderTemplate(
      '{% for k, v in items %}{{ k }}{% else %}empty{% endfor %}',
      { items: {} }
    );
    expect(result).toBe('empty');
  });
  test('else does not fire on non-empty object', async () => {
    const result = await renderTemplate(
      '{% for k, v in items %}{{ k }}{% else %}empty{% endfor %}',
      { items: { a: 1 } }
    );
    expect(result).toBe('a');
  });
  test('nested for-else fires inner else', async () => {
    const result = await renderTemplate(
      '{% for x in outer %}{% for y in inner %}{{ y }}{% else %}-{% endfor %}|{% endfor %}',
      { outer: [1, 2], inner: [] }
    );
    expect(result).toBe('-|-|');
  });
  test('for-else with loop variables in else block', async () => {
    const result = await renderTemplate(
      '{% for x in items %}{{ x }}{% else %}count=0{% endfor %}',
      { items: [] }
    );
    expect(result).toBe('count=0');
  });
});

describe('component', () => {
  test('component definition and call', async () => {
    const result = await renderTemplate(
      '{% component greet(name) %}Hello {{ name }}{% endcomponent %}{{ greet("World") }}'
    );
    expect(result).toBe('Hello World');
  });
  test('component with default args', async () => {
    const result = await renderTemplate(
      '{% component greet(name = "Guest") %}Hi {{ name }}{% endcomponent %}{{ greet() }}'
    );
    expect(result).toBe('Hi Guest');
  });
});

describe('scope isolation', () => {
  test('loop variable does not leak', async () => {
    const result = await renderTemplate(
      '{% for i in [1,2,3] %}{{ i }}{% endfor %}[{{ i is defined }}]'
    );
    expect(result).toContain('[false]');
  });
});

describe('undefined modes', () => {
  test('chainable mode renders undefined', async () => {
    const result = await renderTemplate('{{ missing }}', {}, { undefined: 'chainable' });
    expect(typeof result).toBe('string');
  });
  test('strict mode throws', async () => {
    const result = await renderTemplate('{{ missing }}', {}, { undefined: 'strict' }).catch(
      (e) => e
    );
    expect(result).toBeInstanceOf(Error);
  });
});

describe('miss sentinels behave falsy (classic semantics)', () => {
  // WHY: memberLookup returns a CALLABLE not-found sentinel (so `obj.missing()` yields
  // undefined) — raw JS truthiness would invert every condition on a missing property.
  test('{% if obj.missing %} takes the false branch', async () => {
    const result = await renderTemplate(
      '{% if obj.missing %}yes{% else %}no{% endif %}',
      { obj: {} }
    );
    expect(result).toBe('no');
  });

  test('{% if nullObj.prop %} takes the false branch', async () => {
    const result = await renderTemplate(
      '{% if nullObj.prop %}yes{% else %}no{% endif %}',
      { nullObj: null }
    );
    expect(result).toBe('no');
  });

  test('inline if on a miss picks the alternate', async () => {
    const result = await renderTemplate('{{ obj.missing if obj.missing else "fallback" }}', {
      obj: {},
    });
    expect(result).toBe('fallback');
  });

  test('not on a miss is true', async () => {
    const result = await renderTemplate('{{ not obj.missing }}', { obj: {} });
    expect(result).toBe('true');
  });

  test('is defined / is undefined / is none see through sentinels', async () => {
    expect(await renderTemplate('{{ obj.missing is defined }}', { obj: {} })).toBe('false');
    expect(await renderTemplate('{{ obj.missing is undefined }}', { obj: {} })).toBe('true');
    expect(await renderTemplate('{{ obj.missing is none }}', { obj: {} })).toBe('true');
    expect(await renderTemplate('{{ obj.missing is not defined }}', { obj: {} })).toBe('true');
  });

  test('is none vs is null keep distinct semantics', async () => {
    expect(await renderTemplate('{{ missing is none }}', {})).toBe('true');
    expect(await renderTemplate('{{ missing is null }}', {})).toBe('false');
    expect(await renderTemplate('{{ nil is none }}', { nil: null })).toBe('true');
    expect(await renderTemplate('{{ nil is null }}', { nil: null })).toBe('true');
  });

  test('truthy/falsy tests fold sentinels', async () => {
    expect(await renderTemplate('{{ obj.missing is truthy }}', { obj: {} })).toBe('false');
    expect(await renderTemplate('{{ obj.missing is falsy }}', { obj: {} })).toBe('true');
  });

  test('filter args receive undefined, never the sentinel object', async () => {
    const result = await renderTemplate('{{ obj.missing |> length }}', { obj: {} });
    expect(result).not.toContain('=>');
    expect(result).not.toContain('[object');
  });

  test('calling a miss still yields undefined (callable sentinel preserved)', async () => {
    const result = await renderTemplate('{{ obj.missing() }}', { obj: {} });
    expect(result).toBe('undefined');
  });
});

describe('autoescape', () => {
  test('autoescape on escapes HTML', async () => {
    const result = await renderTemplate('{{ x }}', { x: '<script>' }, { autoescape: true });
    expect(result).toContain('&lt;script&gt;');
  });
  test('autoescape off', async () => {
    const result = await renderTemplate('{{ x }}', { x: '<b>' }, { autoescape: false });
    expect(result).toBe('<b>');
  });
});

describe('whitespace control', () => {
  test('strip trailing whitespace with -%}', async () => {
    const result = await renderTemplate('x   -%}\n  y');
    expect(result).toContain('x');
  });
  test('strip leading whitespace with {%-', async () => {
    const result = await renderTemplate('  {%- if true %}yes{% endif %}');
    expect(result.trim()).toBe('yes');
  });
  test('strip around variables {{- -}}', async () => {
    expect(await renderTemplate('a\n  {{- x -}}\n  b', { x: 'X' })).toBe('aXb');
  });

  // WHY: trimBlocks/lstripBlocks were previously stored on lexer state but never
  // consumed — the config was a silent no-op. These tests pin the restored semantics:
  // trimBlocks removes ONE newline after a block end; lstripBlocks removes
  // line-leading whitespace before a block tag only.
  test('trimBlocks removes the first newline after %}', async () => {
    expect(await renderTemplate('{% if true %}\nx\n{% endif %}', {}, { trimBlocks: true })).toBe(
      'x\n'
    );
  });
  test('trimBlocks handles CRLF newlines', async () => {
    expect(
      await renderTemplate('{% if true %}\r\nx{% endif %}', {}, { trimBlocks: true })
    ).toBe('x');
  });
  test('trimBlocks does not affect variable tags', async () => {
    expect(await renderTemplate('a{{ "x" }}\nb', {}, { trimBlocks: true })).toBe('ax\nb');
  });
  test('lstripBlocks strips line-leading whitespace before block tags', async () => {
    expect(
      await renderTemplate('div\n  {% if true %}x{% endif %}', {}, { lstripBlocks: true })
    ).toBe('div\nx');
  });
  test('lstripBlocks keeps mid-line whitespace', async () => {
    expect(
      await renderTemplate('a {% if true %}x{% endif %}', {}, { lstripBlocks: true })
    ).toBe('a x');
  });
  test('lstripBlocks does not affect variable tags', async () => {
    expect(await renderTemplate('a\n  {{ "x" }}', {}, { lstripBlocks: true })).toBe('a\n  x');
  });
  test('trimBlocks and lstripBlocks combine', async () => {
    expect(
      await renderTemplate(
        '{% if true %}\n  {% if true %}x{% endif %}\n  {% endif %}',
        {},
        { trimBlocks: true, lstripBlocks: true }
      )
    ).toBe('x');
  });
  test('both options default to off', async () => {
    expect(await renderTemplate('{% if true %}\nx\n{% endif %}')).toBe('\nx\n');
  });
});

describe('walrus operator', () => {
  test('assign and output in one expression', async () => {
    expect(await renderTemplate('{{ (x := 42) }}{{ x }}')).toBe('4242');
  });
  test('assign in condition', async () => {
    expect(
      await renderTemplate('{% if (x := items[0]) %}{{ x }}{% endif %}', { items: ['first'] })
    ).toBe('first');
  });
});

describe('slot fallback', () => {
  test('missing slot renders empty', async () => {
    expect(
      await renderTemplate(
        '{% component c %}[{{ children }}]{% endcomponent %}{% render c %}{% endrender %}'
      )
    ).toBe('[]');
  });
});

describe('switch statement', () => {
  test('switch matches first case', async () => {
    expect(await renderTemplate('{% switch x %}{% case 1 %}one{% endswitch %}', { x: 1 })).toBe(
      'one'
    );
  });
  test('switch falls through to matching case', async () => {
    expect(
      await renderTemplate('{% switch x %}{% case 1 %}{% case 2 %}both{% endswitch %}', { x: 2 })
    ).toBe('both');
  });
  test('switch default fires when no match', async () => {
    expect(
      await renderTemplate('{% switch x %}{% case 1 %}one{% default %}def{% endswitch %}', { x: 3 })
    ).toBe('def');
  });
});

describe('tilde (~) string concatenation', () => {
  test('concatenates two strings', async () => {
    expect(await renderTemplate('{{ "a" ~ "b" }}')).toBe('ab');
  });
  test('coerces numbers to string', async () => {
    expect(await renderTemplate('{{ 1 ~ 2 }}')).toBe('12');
  });
  test('concatenates string and number', async () => {
    expect(await renderTemplate('{{ "n: " ~ 42 }}')).toBe('n: 42');
  });
  test('chained tilde', async () => {
    expect(await renderTemplate('{{ "a" ~ "b" ~ "c" }}')).toBe('abc');
  });
  test('tilde with parenthesized expression', async () => {
    expect(await renderTemplate('{{ "r: " ~ (1 + 2) }}')).toBe('r: 3');
  });
  test('tilde works in conditions', async () => {
    expect(await renderTemplate('{% if ("a" ~ "b") == "ab" %}yes{% endif %}')).toBe('yes');
  });
  test('plus operator still does numeric addition', async () => {
    expect(await renderTemplate('{{ 1 + 2 }}')).toBe('3');
  });
});

describe('primitive method access', () => {
  test('string method call', async () => {
    expect(await renderTemplate('{{ s.toUpperCase() }}', { s: 'hi' })).toBe('HI');
  });
  test('number method call', async () => {
    expect(await renderTemplate('{{ n.toFixed(2) }}', { n: 42.567 })).toBe('42.57');
  });
  test('string length property', async () => {
    expect(await renderTemplate('{{ s.length }}', { s: 'hello' })).toBe('5');
  });
});

describe('match/when pattern matching', () => {
  test('literal match', async () => {
    expect(
      await renderTemplate(
        '{% match x %}{% when 1 %}one{% when 2 %}two{% when _ %}other{% endmatch %}',
        { x: 1 }
      )
    ).toBe('one');
  });
  test('literal match second case', async () => {
    expect(
      await renderTemplate(
        '{% match x %}{% when 1 %}one{% when 2 %}two{% when _ %}other{% endmatch %}',
        { x: 2 }
      )
    ).toBe('two');
  });
  test('wildcard default', async () => {
    expect(
      await renderTemplate('{% match x %}{% when 1 %}one{% when _ %}other{% endmatch %}', { x: 99 })
    ).toBe('other');
  });
  test('guard positive', async () => {
    expect(
      await renderTemplate(
        '{% match x %}{% when n if n > 0 %}pos{% when n if n < 0 %}neg{% when _ %}zero{% endmatch %}',
        { x: 5 }
      )
    ).toBe('pos');
  });
  test('guard negative', async () => {
    expect(
      await renderTemplate(
        '{% match x %}{% when n if n > 0 %}pos{% when n if n < 0 %}neg{% when _ %}zero{% endmatch %}',
        { x: -5 }
      )
    ).toBe('neg');
  });
  test('guard zero', async () => {
    expect(
      await renderTemplate(
        '{% match x %}{% when n if n > 0 %}pos{% when n if n < 0 %}neg{% when _ %}zero{% endmatch %}',
        { x: 0 }
      )
    ).toBe('zero');
  });
  test('variable binding', async () => {
    expect(
      await renderTemplate('{% match x %}{% when val %}got {{ val }}{% endmatch %}', { x: 'hello' })
    ).toBe('got hello');
  });
  test('string literal match', async () => {
    expect(
      await renderTemplate("{% match s %}{% when 'hi' %}hello{% when _ %}bye{% endmatch %}", {
        s: 'hi',
      })
    ).toBe('hello');
  });
});

describe('raw and verbatim blocks', () => {
  test('raw block emits template syntax literally', async () => {
    expect(await renderTemplate('{% raw %}{{ x }}{% endraw %}')).toBe('{{ x }}');
  });

  // WHY: regression — the raw tokenizer used to scan past {% endraw %} to end-of-input,
  // so the close tag leaked into output whenever content followed the block.
  test('raw block terminates at endraw with trailing content', async () => {
    expect(await renderTemplate('A{% raw %}{{ x }}{% endraw %}B')).toBe('A{{ x }}B');
  });

  test('verbatim block terminates with trailing content', async () => {
    expect(await renderTemplate('A{% verbatim %}{{ x }}{% endverbatim %}B')).toBe('A{{ x }}B');
  });

  test('nested raw blocks emit inner tags literally', async () => {
    expect(
      await renderTemplate('{% raw %}a{% raw %}b{% endraw %}c{% endraw %}tail')
    ).toBe('a{% raw %}b{% endraw %}ctail');
  });

  test('mismatched end tag stays literal content', async () => {
    expect(await renderTemplate('{% raw %}t{% endverbatim %}m{% endraw %}!')).toBe(
      't{% endverbatim %}m!'
    );
  });
});

describe('range operator (..)', () => {
  test('range in for loop', async () => {
    expect(await renderTemplate('{% for i in 1..5 %}{{ i }}{% endfor %}')).toBe('12345');
  });
  test('range with variables', async () => {
    expect(
      await renderTemplate('{% for i in start..end %}{{ i }}{% endfor %}', { start: 3, end: 7 })
    ).toBe('34567');
  });
  test('range single element', async () => {
    expect(await renderTemplate('{% for i in 5..5 %}{{ i }}{% endfor %}')).toBe('5');
  });
});

describe('capture tag', () => {
  test('capture and use once', async () => {
    expect(
      await renderTemplate('{% capture greeting %}Hello {{ name }}{% endcapture %}{{ greeting }}', {
        name: 'World',
      })
    ).toBe('Hello World');
  });
  test('capture and reuse multiple times', async () => {
    expect(
      await renderTemplate(
        '{% capture btn %}<button>{{ label }}</button>{% endcapture %}{{ btn }}{{ btn }}',
        { label: 'Click' }
      )
    ).toBe('<button>Click</button><button>Click</button>');
  });
  test('capture with for loop inside', async () => {
    expect(
      await renderTemplate(
        '{% capture list %}{% for i in items %}{{ i }}{% endfor %}{% endcapture %}{{ list }}',
        { items: [1, 2, 3] }
      )
    ).toBe('123');
  });
  test('capture then pipe to filter', async () => {
    expect(await renderTemplate('{% capture raw %}  hi  {% endcapture %}{{ raw |> trim }}')).toBe(
      'hi'
    );
  });
  test('capture in condition', async () => {
    expect(
      await renderTemplate(
        '{% capture content %}{{ items |> join(",") }}{% endcapture %}{% if content %}Items: {{ content }}{% endif %}',
        { items: ['a', 'b'] }
      )
    ).toBe('Items: a,b');
  });
  test('capture empty check', async () => {
    expect(
      await renderTemplate(
        '{% capture content %}{% endcapture %}{% if content %}yes{% else %}no{% endif %}'
      )
    ).toBe('no');
  });
});

describe('filter block', () => {
  test('applies filter to block content', async () => {
    expect(await renderTemplate('{% filter upper %}hello{% endfilter %}')).toBe('HELLO');
  });
  test('applies filter to expression content', async () => {
    expect(
      await renderTemplate('{% filter upper %}{{ name }}{% endfilter %}', { name: 'world' })
    ).toBe('WORLD');
  });
  test('filter with arguments', async () => {
    expect(await renderTemplate('{% filter replace("o", "0") %}hello{% endfilter %}')).toBe(
      'hell0'
    );
  });
});

describe('component as UI primitive', () => {
  test('component with parameters', async () => {
    expect(
      await renderTemplate(
        '{% component card(title, price) %}<div>{{ title }}:{{ price }}</div>{% endcomponent %}{{ card("Kopi", 15000) }}'
      )
    ).toBe('<div>Kopi:15000</div>');
  });
  test('component with default args', async () => {
    expect(
      await renderTemplate(
        '{% component btn(label, type = "primary") %}<button class="{{ type }}">{{ label }}</button>{% endcomponent %}{{ btn("Save") }}'
      )
    ).toBe('<button class="primary">Save</button>');
  });
  test('component called multiple times', async () => {
    expect(
      await renderTemplate(
        '{% component tag(name) %}<{{ name }}>{% endcomponent %}{{ tag("a") }}{{ tag("b") }}'
      )
    ).toBe('<a><b>');
  });
});

describe('render/slot (composition)', () => {
  test('basic render with children', async () => {
    expect(
      await renderTemplate(
        '{% component card(title) %}<div><h3>{{ title }}</h3><div>{{ children }}</div></div>{% endcomponent %}' +
          '{% render card("Hi") %}<p>Body</p>{% endrender %}'
      )
    ).toBe('<div><h3>Hi</h3><div><p>Body</p></div></div>');
  });

  test('scoped slot with params', async () => {
    expect(
      await renderTemplate(
        '{% component list(items) %}<ul>{% for item in items %}<li>{{ slot("default", item) }}</li>{% endfor %}</ul>{% endcomponent %}' +
          '{% render list(products) %}{% slot default(item) %}{{ item.name }}:{{ item.price }}{% endslot %}{% endrender %}',
        {
          products: [
            { name: 'A', price: 100 },
            { name: 'B', price: 200 },
          ],
        }
      )
    ).toBe('<ul><li>A:100</li><li>B:200</li></ul>');
  });

  test('render without children reference (still works)', async () => {
    expect(
      await renderTemplate(
        '{% component greet(name) %}Hello {{ name }}{% endcomponent %}' +
          '{% render greet("World") %}{% endrender %}'
      )
    ).toBe('Hello World');
  });

  test('render with HTML content', async () => {
    expect(
      await renderTemplate(
        '{% component dialog(title) %}<dialog><h2>{{ title }}</h2>{{ children }}</dialog>{% endcomponent %}' +
          '{% render dialog("Confirm") %}<button>OK</button>{% endrender %}'
      )
    ).toBe('<dialog><h2>Confirm</h2><button>OK</button></dialog>');
  });
});

describe('named slots', () => {
  test('named slots header/body/footer', async () => {
    expect(
      await renderTemplate(
        '{% component card() %}<h>{{ slot("header") }}</h><b>{{ children }}</b><f>{{ slot("footer") }}</f>{% endcomponent %}' +
          '{% render card() %}Default {% slot header %}Title{% endslot %}{% slot footer %}Bottom{% endslot %}{% endrender %}'
      )
    ).toBe('<h>Title</h><b>Default </b><f>Bottom</f>');
  });

  test('children as default slot', async () => {
    expect(
      await renderTemplate(
        '{% component wrap() %}<div>{{ children }}</div>{% endcomponent %}' +
          '{% render wrap() %}Hello{% endrender %}'
      )
    ).toBe('<div>Hello</div>');
  });

  test('scoped named slot with props', async () => {
    expect(
      await renderTemplate(
        '{% component table(items) %}{% for item in items %}{{ slot("row", item) }}{% endfor %}{% endcomponent %}' +
          '{% render table(data) %}{% slot row(item) %}[{{ item.name }}]{% endslot %}{% endrender %}',
        { data: [{ name: 'A' }, { name: 'B' }] }
      )
    ).toBe('[A][B]');
  });

  test('missing named slot renders empty', async () => {
    expect(
      await renderTemplate(
        '{% component opt() %}[{{ slot("optional") }}]{% endcomponent %}' +
          '{% render opt() %}body{% endrender %}'
      )
    ).toBe('[]');
  });

  test('slot.has() distinguishes provided from missing', async () => {
    expect(
      await renderTemplate(
        '{% component d() %}{% if slot.has("x") %}{{ slot("x") }}{% else %}none{% endif %}{% endcomponent %}' +
          '{% render d() %}{% endrender %}'
      )
    ).toBe('none');
  });
});
