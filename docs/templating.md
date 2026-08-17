# Template Language Reference

This documents **this engine's** language (the TypeScript `@nunjucks/*` rewrite) — not upstream nunjucks 3.x. Deviations from upstream are flagged. The public entry point is `nunjucks(config)` from `@nunjucks/core`; see the root `README.md` for the API and configuration.

- [Output](#output)
- [Comments & whitespace](#comments--whitespace)
- [Undefined handling](#undefined-handling)
- [Expressions](#expressions)
- [Tags](#tags)
- [Filters](#filters)
- [Tests (`is`)](#tests-is)
- [Components & slots](#components--slots)
- [Custom extensions](#custom-extensions)

## Output

`{{ expression }}` evaluates, awaits promises, and outputs the value HTML-escaped unless it is a `SafeString` (produced by `escape`, `tojson`, `sanitize`, `{% capture %}`, components, and slots).

Autoescaping is **context-aware**: the compiler tracks whether an interpolation sits in an HTML body, attribute, `<script>`, `<style>`, or comment zone and escapes accordingly. In script context, non-JSON-safe values are rejected (`JSON_ESCAPED_OUTPUT`) instead of naively stringified.

Security defaults (always on, sandbox not required):

- Inherited reads of `__proto__`, `constructor`, and `prototype` are treated as not-found (`{{ x.constructor.constructor("...")() }}` cannot reach `Function`). Normal inherited methods (`{{ "abc".toUpperCase() }}`) keep working; own properties are the host's explicit choice.
- Interpolations in **unquoted** attribute positions (`<div class={{ v }}>`) are percent-encoded (` `, `=`, quotes, `<>&` become `%20`-style) — quote your attributes to preserve literal values.
- Error pages/markers default to the production minimal page; stacks, render-context data, and caller source only render with `dev: true`.

## Comments & whitespace

- `{# comment #}` is stripped entirely; `{#- ... -#}` additionally strips surrounding whitespace.
- `{{- expr -}}` / `{%- tag -%}` always strip adjacent whitespace.
- `trimBlocks: true` removes the single newline after `%}`; `lstripBlocks: true` removes line-leading whitespace before `{%` tags (never before `{{`/`{#`).

## Undefined handling

`undefined` config mode (`default` at the factory):

| Mode | `{{ missing }}` behaves as |
|------|----------------------------|
| `default` | renders the literal string `undefined` |
| `strict` | throws `UNDEFINED_VARIABLE` / `UNDEFINED_PROPERTY` / `NULL_VALUE` |

> **Pipes and strict mode:** the strict boundary guards the *output* expression, not filter *inputs* — `{{ missing |> fallback("x") }}` still works (that is `fallback`'s contract), and `{{ a.b |> upper }}` renders the filter's normalized result. To get a strict error for an undefined access, emit it un-piped (`{{ a.b }}`).
| `debug` | renders `undefined` and collects a warning (surfaced in dev mode) |
| `chainable` | renders the literal string `undefined`; member access on undefined never throws (the engine's internal default handled mode) |

## Expressions

| Feature | Syntax | Notes |
|---------|--------|-------|
| Pipe | `x \|> filter(args) \|> other` | filter-first chaining — **deviation**: replaces upstream's `\|` |
| Walrus | `{{ x := expr }}`, `[a, b] := arr`, `{name} := obj` | **deviation**: `{% set %}` does not exist; member targets (`obj.k := v`) are rejected |
| Compound assign | `+= -= *= /= %= **= //= &&= ??=` | expression-level |
| Optional chaining | `a?.b`, `a?.[i]`, `a?.()` | |
| Nullish / ternary / inline-if | `a ?? b`, `c ? a : b`, `a if c else b` | |
| Comparisons | `== === != !== < > <= >=` | chainable: `1 < x < 5` |
| `in` / `is` | `2 in [1,2]`, `x is defined`, `x is not null` | right side of `is` is always a test name |
| Arithmetic | `+ - * / % **`, floor-div `7 // 2`, concat `~`, range `1..4` | ranges are integer-only and capped — a span over 1,000,000 throws `RANGE_EXCEEDED` (e.g. `{{ 1..3000000000 }}`) |
| Unary | `- + ! not ~`, `++`/`--` (pre/post) | |
| Bitwise | `& \| ^ << >>` | |
| Literals | `'…'`, `"…"`, int/float, `true`/`false`, `none`/`null`, arrays `[1, ...rest]`, dicts `{a: 1, b, ...more}` | spread + shorthand supported |
| Lookups | `a.b`, `a["k"]`, slices `a[1:3]`, `a[::2]`, `a[::-1]` | Python-style slices |
| Template literals | `` `hi ${name}` `` | **restriction**: interpolations must be simple identifiers |
| Regex literals | not supported | pass `RegExp` objects via context/tests |
| Destructuring | holes `[a, , c]`, defaults `[a = 1]`, rest `[first, ...r]`, nested objects | usable in walrus and `for` targets |

Unterminated strings, comments, and template literals raise `UNTERMINATED_LITERAL` (positioned at the opening delimiter) instead of silently consuming the rest of the template.

## Tags

### Control flow

- `{% if c %}…{% elif c %}…{% else %}…{% endif %}` (`elseif` alias supported)
  - Truthiness is engine-evaluated: `{% if %}` conditions, inline `x if c else y`, and `not` all fold miss sentinels (absent lookups) to falsy — classic semantics.
- `{% for x in items %}…{% else %}…{% endfor %}` — targets: symbol, `k, v` pairs, or full destructuring patterns. Objects iterate `for k, v in obj`; strings iterate characters; Map/Set/iterables are coerced. `{% else %}` fires on empty collections.
  - `loop.*`: `index`, `index0`, `revindex`, `revindex0`, `first`, `last`, `length` — exactly these (**deviation**: no `loop.cycle`, no `loop.depth`).
- `{% switch expr %}{% case v %}…{% default %}…{% endswitch %}` — strict equality, no fallthrough.
- `{% match expr %}{% when pattern if guard %}…{% when _ %}…{% endmatch %}` — patterns: literal, binding symbol, `_` wildcard.
- `{% scope a=1, b=2 %}…{% endscope %}` — isolated frame; walrus assignments inside do not leak out.
- `{% exec expr %}` — evaluate for side effects, no output.
- `{% capture varname %}…{% endcapture %}` — render body into a SafeString binding.
- `{% filter upper %}…{% endfilter %}` — pipe the captured body through a filter.

### Inheritance & reuse

- `{% extends "parent.njk" %}` with `{% block name %}…{% endblock %}`; `{{ super() }}` emits the parent block (SafeString) and binds to the nearest enclosing block in the current inheritance chain (nested-block scoping). Duplicate/undefined blocks fail validation with catalogued errors.
- `{% include expr %}` — flags: `ignore missing`, `only` (empty context), `with expr` (merge context).
- `{% import "lib.njk" as lib %}`, `{% from "lib.njk" import a, b as c %}` (+ `with context` / `without context`; default **without**). Imports bind exported `{% component %}` definitions.

### Raw

`{% raw %}…{% endraw %}` (alias `{% verbatim %}`) emits the body literally; nesting supported via depth counting.

**Deviation:** `{% set %}`, `{% macro %}`, `{% call %}`, `{% asyncEach %}`, `{% asyncAll %}` do not exist. Assignment is the walrus operator; macros are components.

## Filters

Registered set (aliases in parentheses). All return `Result` internally; failures surface as catalogued filter errors.

> **Note on parameter names below:** signatures use the positional/upstream-nunjucks style for readability. The registered keyword-argument names differ in a few filters (e.g. `indent` registers `indentfirst`, `truncate` registers `length`, `replace` registers `newValue`/`maxCount`, `fallback` registers `val`/`def`/`bool`) — prefer positional arguments to avoid misbinding kwargs.

**String** — `capitalize`, `escape` (`e`) HTML-escape → SafeString, `fallback` (`default`, `d`) `(value, fallback, useFalsy=false)`, `indent(width=4, first=false)`, `lower`, `upper`, `trim`, `title`, `replace(old, new, max=-1)` (string or RegExp needle), `truncate(len=255, killwords=false, end='...')`, `tojson` (XSS-safe JSON → SafeString).

**Array** — `first`, `last`, `length` / `lengthFilter` (both names callable — the internal function name is registered alongside its upstream-compat alias), `reverse`, `join(delim='', attr)` (array input; errors on non-arrays), `slice(n, fill)` (n near-equal columns), `sort`, `sum(attr?, start=0)`.

**Object** — `groupby(attr)` → `Record<key, items[]>`.

**Math** — `abs`, `round(precision=0, method='round'|'ceil'|'floor')`.

**URL** — `urlencode` (string → `encodeURIComponent`; object/pairs → query string).

**Security** — `escape`, `tojson`, `sanitize(html, config?)` DOMPurify-backed → SafeString; global DOMPurify options via `dompurify` config.

**Deviation:** no `safe`, `striptags`, `int`, `float`, `random`, `wordcount`, `urlize`, `center`, `dictsort`, `dump`, `list`, `filesizeformat`, `nl2br`. Supply what you need via `config.filters`.

## Tests (`is`)

`value is <test>`, `value is not <test>`. Built-ins:

- existence: `defined`, `undefined`, `null` (strict `=== null` only), `none` (null or undefined), `truthy`, `falsy`
- boolean/numeric: `true`, `false`, `boolean`, `number`, `integer`, `float`, `odd`, `even`, `positive`, `negative`, `zero`, `finite`, `nan`, `divisibleby(n)`, `between(lo, hi)`
- string: `string`, `lower`, `upper`, `alpha`, `alphanumeric`, `numeric`, `startswith(s)`, `endswith(s)`, `matches(re)`, `empty`, `blank`, `contains(x)`
- collections: `array`, `object`, `iterable`, `asynciterable`, `typedarray`, `buffer`
- types: `bigint`, `symbol`, `function`, `asyncfunction`, `Map`, `Set`, `Date`, `RegExp`, `Error`, `URL`, `Promise`
- misc: `sameas(x)` (`===`), `equalto(x)` (deep compare), `has(k)`, `hasown(k)`, `safe`, `escaped` (true when NOT SafeString)

Unknown test names throw `UNDEFINED_TEST` at runtime (custom tests resolve via `config.tests`).

## Components & slots

**deviation**: replaces `{% macro %}`/`{% call %}`.

```njk
{# definition — a callable bound to `card`, extra props spread at render time #}
{% component card(title, cls="box") %}
  <div class="{{ cls }}">{{ title }}{{ children }}{{ slot("footer") }}</div>
{% endcomponent %}

{# invocation — body becomes the default slot; {% slot %} fills named slots #}
{% render card("Hi", cls="hero") %}
  Main content here.
  {% slot footer %}<small>© 2026</small>{% endslot %}
{% endrender %}
```

- `{{ children }}` is the default slot; `{{ slot("name") }}` reads named slots.
- `{% slot name(params) %}` (name defaults to `default`) is only valid inside `component`/`render` bodies.
- Components return SafeString; underscore-prefixed definitions (`{% component _private %}`) are not exported via `import`/`from`.

## Custom extensions

Filters, globals, and tests are plain config maps (`filters`, `globals`, `tests`), optionally bundled as `plugins`. Custom tags are `extensions`:

```ts
import { nunjucks } from '@nunjucks/core';

const helloExtension = {
  extensionName: 'hello',          // runtime lookup key
  tags: ['hello'],                 // parser dispatch: {% hello %}
  autoescape: true,
  parse: (parserContext, nodes) => {
    /* consume tokens, return nodes.callExtension(...) */
  },
  run: (context, ...args) => 'Hello from extension!',
};

const njk = nunjucks({ extensions: { hello: helloExtension } });
```

Parser-authoring helpers (`advanceAfterBlockEnd`, `skipSymbol`, `peekToken`, `nextToken`, `fail`, `consumeWhitespaceDrop`) are exported from `@nunjucks/parser`. Precedence: built-ins → plugins (left-to-right) → direct config maps.

## Defaults at a glance

| Option | Default |
|--------|---------|
| `autoescape` | `true` (context-aware) |
| `undefined` | `'default'` |
| `trimBlocks` / `lstripBlocks` | `false` |
| `dev` | `false` (appends warnings script when warnings exist) |
| `security.sandbox` | `false` |
| `security.sandboxEnvironment` | `'auto'` (environment-aware blocking: `'auto'`/`'node'`/`'browser'`/`'deno'`) |
| `limits.*` | `0` (unlimited) |
