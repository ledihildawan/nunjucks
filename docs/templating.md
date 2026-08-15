---
layout: subpage
title: Templates
---
{% raw %}

# Templating

This is an overview of the templating features available in Nunjucks.

> Nunjucks is essentially a port of
> [jinja2](http://jinja.pocoo.org/docs/), so you can read their
> [docs](http://jinja.pocoo.org/docs/templates/) if you find anything
> lacking here. Read about the differences
> [here](http://mozilla.github.io/nunjucks/faq.html#can-i-use-the-same-templates-between-nunjucks-and-jinja2-what-are-the-differences).

## User-Defined Templates Warning

  nunjucks does not sandbox execution so **it is not safe to run
  user-defined templates or inject user-defined content into template
  definitions**. On the server, you can expose attack vectors for
  accessing sensitive data and remote code execution. On the client,
  you can expose cross-site scripting vulnerabilities even for
  precompiled templates (which can be mitigated with a strong
  [CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy)). See
  [this issue](https://github.com/mozilla/nunjucks-docs/issues/17) for
  more information.

## File Extensions

Although you are free to use any file extension you wish for your
Nunjucks template files, the Nunjucks community has adopted  `.njk`.

If you are developing tools or editor syntax helpers for Nunjucks, please
include recognition of the `.njk` extension.

## Syntax Highlighting

Plugins are available in various editors to support the `jinja` syntax highlighting of Nunjucks.

* atom <https://github.com/alohaas/language-nunjucks>
* vim <https://github.com/niftylettuce/vim-jinja>
* brackets <https://github.com/axelboc/nunjucks-brackets>
* sublime <https://github.com/mogga/sublime-nunjucks/blob/master/Nunjucks.tmLanguage>
* emacs <http://web-mode.org>
* vscode <https://github.com/ronnidc/vscode-nunjucks>

## Variables

A variable looks up a value from the template context. If you wanted
to simply display a variable, you would do:

```jinja
{{ username }}
```

This looks up `username` from the context and displays it. Variable
names can have dots in them which lookup properties, just like
javascript. You can also use the square bracket syntax.

```jinja
{{ foo.bar }}
{{ foo["bar"] }}
```

These two forms to the exact same thing, just like javascript.

If a value is `undefined` or `null`, the literal string `undefined` is
displayed in the default (chainable) mode. The `undefined` engine option
controls this behavior:

* `chainable` (default) — renders `undefined` and tolerates chained lookups
  (`{{ a.b.c }}` on missing `a`)
* `strict` — raises `UNDEFINED_VARIABLE` on the first undefined access
* `debug` — renders like chainable but emits a warning for every undefined access
* `default` — same rendering as chainable

Use the nullish coalescing operator to substitute a fallback instead:
`{{ nickname ?? username ?? "anonymous" }}`.

## Filters

Filters are essentially functions that can be applied to variables.
They are called with the pipe operator (`|>`) and can take arguments.

```jinja
{{ foo |> title }}
{{ foo |> join(",") }}
{{ foo |> replace("foo", "bar") |> capitalize }}
```

The third example shows how you can chain filters. It would display
"Bar", by first replacing "foo" with "bar" and then capitalizing it.

Nunjucks comes with several
[builtin filters](#builtin-filters), and you can
[add your own](api#custom-filters) as well.

## Template Inheritance

Template inheritance is a way to make it easy to reuse templates.
When writing a template, you can define "blocks" that child templates
can override. The inheritance chain can be as long as you like.

If we have a template `parent.html` that looks like this:

```jinja
{% block header %}
This is the default content
{% endblock %}

<section class="left">
  {% block left %}{% endblock %}
</section>

<section class="right">
  {% block right %}
  This is more content
  {% endblock %}
</section>
```

And we render this template:

```jinja
{% extends "parent.html" %}

{% block left %}
This is the left side!
{% endblock %}

{% block right %}
This is the right side!
{% endblock %}
```

The output would be:

```jinja
This is the default content

<section class="left">
  This is the left side!
</section>

<section class="right">
  This is the right side!
</section>
```

You can store the template to inherit in a variable and use it by
omitting quotes. This variable can contain a string that points to a
template file, or it can contain a compiled Template object that has
been added to the context. That way you can dynamically change
which template is inherited when rendering by setting it in the context.

```jinja
{% extends parentTemplate %}
```

You leverage inheritance with the [`extends`](#extends) and
[`block`](#block) tags. A more detailed explanation of inheritance can
be found in the [jinja2
docs](http://jinja.pocoo.org/docs/templates/#template-inheritance).

### super

You can render the contents of the parent block inside a child block
by calling `super`. If in the child template from above you had:

```jinja
{% block right %}
{{ super() }}
Right side!
{% endblock %}
```

The output of the block would be:

```
This is more content
Right side!
```

## Tags

Tags are special blocks that perform operations on sections of the template.
Nunjucks comes with several builtin, but [you can add your own](api.html#custom-tags).

### if

`if` tests a condition and lets you selectively display content. It behaves
exactly as javascript's `if` behaves.

```jinja
{% if variable %}
  It is true
{% endif %}
```

If variable is defined and evaluates to true, "It is true" will be
displayed. Otherwise, nothing will be.

You can specify alternate conditions with `elif` (or `elseif`, which is simply an alias of `elif`)
and `else`:

```jinja
{% if hungry %}
  I am hungry
{% elif tired %}
  I am tired
{% else %}
  I am good!
{% endif %}
```

You can specify multiple conditions with `and` and `or`:

```jinja
{% if happy and hungry %}
  I am happy *and* hungry; both are true.
{% endif %}

{% if happy or hungry %}
  I am either happy *or* hungry; one or the other is true.
{% endif %}
```

You can also use if as an [inline expression](#if-expression).

### for

`for` iterates over arrays and dictionaries.

Filters that return promises are awaited transparently — a plain `for` loop
works unchanged with async filters, so no special loop tag is required.

```js
var items = [{ title: "foo", id: 1 }, { title: "bar", id: 2}];
```

```jinja
<h1>Posts</h1>
<ul>
{% for item in items %}
  <li>{{ item.title }}</li>
{% else %}
  <li>This would display if the 'item' collection were empty</li>
{% endfor %}
</ul>
```

The above example lists all the posts using the `title` attribute of each item
in the `items` array as the display value. If the `items` array were empty, the
contents of the optional `else` clause would instead be rendered.

You can also iterate over objects/hashes:

```js
var food = {
  'ketchup': '5 tbsp',
  'mustard': '1 tbsp',
  'pickle': '0 tbsp'
};
```

```jinja
{% for ingredient, amount in food %}
  Use {{ amount }} of {{ ingredient }}
{% endfor %}
```

ES iterators are supported, like the new builtin Map and Set. But also
anything implementing the iterable protocol.

```js
var fruits = new Map([
  ["banana", "yellow"],
  ["apple", "red"],
  ["peach", "pink"]
])
```

```jinja
{% for fruit, color in fruits %}
  Did you know that {{ fruit }} is {{ color }}?
{% endfor %}
```

Additionally, Nunjucks will unpack arrays into variables:

```js
var points = [[0, 1, 2], [5, 6, 7], [12, 13, 14]];
```

```jinja
{% for x, y, z in points %}
  Point: {{ x }}, {{ y }}, {{ z }}
{% endfor %}
```

Inside loops, you have access to a few special variables:

* `loop.index`: the current iteration of the loop (1 indexed)
* `loop.index0`: the current iteration of the loop (0 indexed)
* `loop.revindex`: number of iterations until the end (1 indexed)
* `loop.revindex0`: number of iterations until the end (0 based)
* `loop.first`: boolean indicating the first iteration
* `loop.last`: boolean indicating the last iteration
* `loop.length`: total number of items

### component

`component` defines a reusable, parameterized chunk of content — the
replacement for the removed `macro` tag. Inside the body, `{{ children }}`
renders the body passed by the caller and `{{ slot("name") }}` renders named
slots:

```jinja
{% component field(name, type='text') %}
<div class="field">
  <input type="{{ type }}" name="{{ name }}" />
</div>
{% endcomponent %}
```

Components are called like normal functions (default and keyword arguments
work — see [keyword arguments](#keyword-arguments)), or invoked with a body
via `{% render %}`:

```jinja
{{ field('user') }}
{{ field('pass', type='password') }}

{% render box("My Box Title") %}
  <p>This is the content inside the box.</p>
{% endrender %}
```

Everything between `{% render %}` and `{% endrender %}` becomes `children`
inside the component; named slots are filled with
`{% slot name %}...{% endslot %}` in the render body and read with
`{{ slot("name") }}` in the component body. Components defined at the top
level are exported and can be [imported](#import) by other templates.

### := (walrus assignment)

The `{% set %}` tag has been removed. Variables are declared and reassigned
with the walrus operator `:=` directly inside an expression — it binds the
value **without printing it**:

```jinja
{{ username }}
{{ username := "joe" }}
{{ username }}
```

If `username` was initially "james", this would print "james joe".

You can declare several variables at once with destructuring patterns:

```jinja
{{ [x, y, z] := [1, 2, 3] }}
```

An assignment made at the top level changes the value in the global template
context. Inside scoped blocks such as `{% scope %}` or `for` it only
modifies the current scope — use `{% scope %}` to deliberately isolate
declarations:

```jinja
{% scope %}
  {{ answer := 42 }}
  inside: {{ answer }}
{% endscope %}
```

Only plain variables and destructuring patterns are valid targets. Assigning
to a member expression (for example `{{ obj.__proto__ := {} }}`) is rejected
at parse time with `WALRUS_TARGET_INVALID`, which makes prototype pollution
via template assignment unrepresentable. Block capture assignments
(`{% set x %}...{% endset %}`) were removed with `set` — use
[`{% capture %}`](#capture) to capture reusable output.

### extends

`extends` is used to specify template inheritance. The specified
template is used as a base template. See [Template
Inheritance](#template-inheritance).

```jinja
{% extends "base.html" %}
```

You can store the template to inherit in a variable and use it by
omitting quotes. This variable can contain a string that points to a
template file, or it can contain a compiled Template object that has
been added to the context. That way you can dynamically change which template is
inherited when rendering by setting it in the context.

```jinja
{% extends parentTemplate %}
```

In fact, `extends` accepts any arbitrary expression, so you can pass
anything into it, as long as that expression evaluates to a string or
a compiled Template object:

```jinja
{% extends name + ".html" %}`.
```

### block

`block` defines a section on the template and identifies it with a
name. This is used by template inheritance. Base templates can specify
blocks and child templates can override them with new content. See
[Template Inheritance](#template-inheritance).

```jinja
{% block css %}
<link rel="stylesheet" href="app.css" />
{% endblock %}
```

You can even define blocks within looping:

```jinja
{% for item in items %}
{% block item %}{{ item }}{% endblock %}
{% endfor %}
```

Child templates can override the `item` block and change how it is displayed:

```jinja
{% extends "item.html" %}

{% block item %}
The name of the item is: {{ item.name }}
{% endblock %}
```

A special function `super` is available within blocks which will
render the parent block's content. See [super](#super).

### include

`include` pulls in other templates in place. It's useful when you need to share
smaller chunks across several templates that already inherit other templates.

```jinja
{% include "item.html" %}
```

You can even include templates in the middle of loops:

```jinja
{% for item in items %}
{% include "item.html" %}
{% endfor %}
```

This is especially useful for cutting up templates into pieces so that the
browser-side environment can render the small chunks when it needs to change
the page.

`include` actually accepts any arbitrary expression, so you can pass anything
into it, as long as the expression evaluates to a string or a compiled Template
object: `{% include name + ".html" %}`.

It might be useful to not throw an error if a template does not exist. Use the
`ignore missing` option to suppress such errors.

```jinja
{% include "missing.html" ignore missing %}
```

Included templates can themselves `extend` another template (so you could have
a set of related includes that all inherit a common structure). An included
template does not participate in the block structure of its including template;
it has a totally separate inheritance tree and block namespace. In other words,
an `include` is _not_ a pre-processor that pulls the included template code
into the including template before rendering; instead, it fires off a separate
render of the included template, and the results of that render are included.

### import

`import` loads a different template and allows you to access its exported
values. [Components](#component) defined at the top level of a template are
exported, allowing you to reuse them in a different template. (Walrus
declarations are frame-scoped and are not exported.)

Imported templates are processed without the current context by default, so
they do not have access to any of the current template variables.

Let's start with a template called `forms.html` that has the following in it:

```jinja
{% component field(name, type='text') %}
<div class="field">
  <input type="{{ type }}" name="{{ name }}" />
</div>
{% endcomponent %}

{% component label(text) %}
<div>
  <label>{{ text }}</label>
</div>
{% endcomponent %}
```

We can import this template and bind all of its exported values to a variable
so that we can use it:

```jinja
{% import "forms.html" as forms %}

{{ forms.label('Username') }}
{{ forms.field('user') }}
{{ forms.label('Password') }}
{{ forms.field('pass', type='password') }}
```

You can also import specific values from a template into the current namespace
with `from import`:

```jinja
{% from "forms.html" import field, label as description %}

{{ description('Username') }}
{{ field('user') }}
{{ description('Password') }}
{{ field('pass', type='password') }}
```

By adding `with context` to the end of an `import` directive, the imported
template is processed with the current context.

```jinja
{% from "forms.html" import field with context %}
```

`import` actually accepts any arbitrary expression, so you can pass anything
into it, as long as the expression evaluates to a string or a compiled Template
object: `{% import name + ".html" as obj %}`.

### raw

If you want to output any of the special Nunjucks tags like `{{`, you can use
a `{% raw %}` block and anything inside of it will be output as plain text.

### verbatim

`{% verbatim %}` has identical behavior as [`{% raw %}`](#raw). It is added for
compatibility with the [Twig `verbatim` tag](http://twig.sensiolabs.org/doc/tags/verbatim.html).

### filter

A `filter` block allows you to call a filter with the contents of the
block. Instead passing a value with the `|>` syntax, the render
contents from the block will be passed.

```jinja
{% filter title %}
may the force be with you
{% endfilter %}

{% filter replace("force", "forth") %}
may the force be with you
{% endfilter %}
```

### capture

`capture` buffers the rendered output of a block into a variable — the
replacement for removed block assignments (`{% set x %}...{% endset %}`) and
the one-off alternative to [components](#component):

```jinja
{% capture greeting %}
  Hello {{ name }}!
{% endcapture %}

{{ greeting |> trim }}
```

The captured value is a plain string, so it can be piped through filters and
reused anywhere a variable can.

### switch

`switch` dispatches on a value with `case` branches, an optional `default`,
and fall-through for empty cases:

```jinja
{% switch status %}
  {% case "active" %}<span class="ok">Active</span>
  {% case "inactive" %}<span class="off">Inactive</span>
  {% default %}<span>Unknown</span>
{% endswitch %}
```

Case labels accept arbitrary expressions (`{% case 5 + 5 %}`).

### match

`match` is the pattern-oriented dispatch: branches bind the matched value to
a name, refine with `if` guards, and `_` acts as the wildcard:

```jinja
{% match statusCode %}
  {% when 200 %}OK
  {% when code if code >= 500 %}Server error ({{ code }})
  {% when _ %}Other
{% endmatch %}
```

### exec

`exec` runs a side-effecting expression statement (method call, mutation) for
its effect rather than its value — the output-printing `{{ }}` interpolation
is deliberately not used:

```jinja
{% exec items.push("item1") %}
{% exec name.append("!") %}
<p>{{ items |> join(",") }}</p>
```

## Keyword Arguments

jinja2 uses Python's keyword arguments support to allow keyword arguments in
functions and filters. Nunjucks supports keyword arguments as well by
introducing a new calling convention.

Keyword arguments look like this:

```jinja
{{ foo(1, 2, bar=3, baz=4) }}
```

`bar` and `baz` are keyword arguments. Nunjucks converts them into a hash and
passes it as the last argument. It's equivalent to this call in javascript:

```js
foo(1, 2, { bar: 3, baz: 4})
```

Since this is a standard calling convention, it works for all functions and
filters if they are written to expect them. [Read more](api#Keyword-Arguments)
about this in the API section.

[Components](#component) allow you to also use keyword arguments in the
definition, which allows you to specify default values. Nunjucks automatically
maps the keyword arguments to the ones defined with the component.

```
{% component foo(x, y, z=5, w=6) %}
{{ x }}, {{ y }}, {{ z }}, {{ w}}
{% endcomponent %}

{{ foo(1, 2) }}        -> 1, 2, 5, 6
{{ foo(1, 2, w=10) }}  -> 1, 2, 5, 10
```

You can mix positional and keyword arguments with components. For example, you
can specify a positional argument as a keyword argument:

```jinja
{{ foo(20, y=21) }}     -> 20, 21, 5, 6
```

You can also simply pass a positional argument in place of a keyword argument:

```jinja
{{ foo(5, 6, 7, 8) }}   -> 5, 6, 7, 8
```

In this way, you can "skip" positional arguments:

```jinja
{{ foo(8, z=7) }}      -> 8, , 7, 6
```

## Comments

You can write comments using `{#` and `#}`. Comments are completely stripped
out when rendering.

```jinja
{# Loop through all the users #}
{% for user in users %}...{% endfor %}
```

## Whitespace Control

Normally the template engine outputs everything outside of variable and tag
blocks verbatim, with all the whitespace as it is in the file. Occasionally you
don't want the extra whitespace, but you still want to format the template
cleanly, which requires whitespace.

You can tell the engine to strip all leading or trailing whitespace by adding a
minus sign (`-`) to the start or end block or a variable.

```jinja
{% for i in [1,2,3,4,5] -%}
  {{ i }}
{%- endfor %}
```

The exact output of the above would be "12345". The `{%-` strips the whitespace
right before the tag, and `-%}` the strips the whitespace right after the tag.

And the same is for variables: `{{-` will strip the whitespace before the variable,
and `-}}` will strip the whitespace after the variable.

Two engine options automate this control globally (both default to off):

* `trimBlocks: true` — removes exactly one newline after every block-end tag
  (`%}`), leaving variable tags untouched
* `lstripBlocks: true` — removes spaces/tabs from the start of a line up to
  a block-start tag (`{%`), but only when nothing else precedes the tag on
  that line

```js
nunjucks({ trimBlocks: true, lstripBlocks: true });
```

## Expressions

You can use many types of literal expressions that you are used to in javascript.

* Strings: `"How are you?"`, `'How are you?'`
* Numbers: `40`, `30.123`
* Arrays: `[1, 2, "array"]`
* Dicts: `{ one: 1, two: 2 }`
* Boolean: `true`, `false`

### Math

Nunjucks allows you to operate on values (though it should be used sparingly,
as most of your logic should be in code). The following operators are
available:

* Addition: `+`
* Subtraction: `-`
* Division: `/`
* Division and integer truncation: `//`
* Division remainder: `%`
* Multiplication: `*`
* Power: `**`

You can use them like this:

```jinja
{{ 2 + 3 }}       (outputs 5)
{{ 10/5 }}        (outputs 2)
{{ numItems*2 }}
```

### Comparisons

* `==`
* `===`
* `!=`
* `!==`
* `>`
* `>=`
* `<`
* `<=`

Examples:

```jinja
{% if numUsers < 5 %}...{% endif %}
{% if i == 0 %}...{% endif %}
```

### Logic

* `and`
* `or`
* `not`
* Use parentheses to group expressions

Examples:

```jinja
{% if users and showUsers %}...{% endif %}
{% if i == 0 and not hideFirst %}...{% endif %}
{% if (x < 5 or y < 5) and foo %}...{% endif %}
```

### If Expression

Similar to javascript's ternary operator, you can use `if` as if it were an
inline expression:

```jinja
{{ "true" if foo else "false" }}
```

The above outputs the string "true" if foo is truthy, otherwise "false". This
is especially useful for default values like so:

```jinja
{{ baz(foo if foo else "default") }}
```

Unlike javascript's ternary operator, the `else` is optional:

```jinja
{{ "true" if foo }}
```

### Function Calls

If you have passed a javascript method to your template, you can call it like
normal.

```jinja
{{ foo(1, 2, 3) }}
```

### Template Literals

Regular-expression literals (`r/.../` or `/.../`) are NOT supported inside
templates. For string building, use backtick template literals with `${...}`
interpolation, exactly like JavaScript:

```jinja
{{ `Hello ${name}, you have ${count} items` }}
```

Regexes are still reachable through values supplied by the render context —
pass a compiled `RegExp` from the host and use it with the `matches` test:

```jinja
{% if code is matches(pattern) %}
  valid
{% endif %}
```

### Tests

The `is` operator applies a predicate to a value; negate it with `is not`.
Tests work in `if` blocks and [inline if expressions](#if-expression):

```jinja
{% if count is odd %}odd{% endif %}
{% if name is not defined %}anonymous{% endif %}
{{ "cheap" if price is between(0, 100) else "expensive" }}
```

The builtin predicates, by category:

* **existence** — `defined`, `undefined`, `null`, `none`, `truthy`, `falsy`
* **boolean** — `true`, `false`, `boolean`
* **numeric** — `odd`, `even`, `positive`, `negative`, `zero`, `finite`, `nan`, `divisibleby(n)`, `between(low, high)`
* **primitive** — `string`, `number`, `integer`, `float`, `bigint`, `symbol`
* **string** — `empty`, `blank`, `lower`, `upper`, `alpha`, `alphanumeric`, `numeric`, `startswith(s)`, `endswith(s)`, `contains(x)`, `matches(re)`
* **collection** — `array`, `object`, `iterable`, `asynciterable`, `typedarray`, `buffer`, `Map`, `Set`
* **object type** — `function`, `asyncfunction`, `Date`, `RegExp`, `Error`, `URL`, `Promise`
* **equality / membership** — `sameas(x)` (strict `===`), `equalto(x)` (deep JSON equality), `has(key)`, `hasown(key)`
* **html** — `safe` (is a SafeString), `escaped` (is not a SafeString)

## Autoescaping

If autoescaping is turned on in the environment, all output will automatically
be escaped for safe output:

```jinja
{{ foo }}           // &lt;span&gt;
```

If autoescaping is turned off, all output will be rendered as it is. You can
manually escape variables with the `escape` filter (aliased as `e`):

```jinja
{{ foo }}           // <span>
{{ foo |&gt; escape }}  // &lt;span&gt;
```

## Global Functions

The `range`, `cycler`, and `joiner` helpers of original nunjucks have been
removed. The template-visible globals are a curated set of frozen standard
builtins, available in both normal and sandboxed rendering:

* `JSON` (`parse`, `stringify`)
* `Math` (`abs`, `ceil`, `floor`, `round`, `min`, `max`, `PI`, ...)
* `Object` (`keys`, `values`, `entries`, `freeze`, ...)
* `Array` (`isArray`, `from`, `of`, ...)
* `Number` (`isInteger`, `isFinite`, `parseFloat`, ...)
* `String` (`fromCharCode`, ...)
* `Date` (`now`, `isDate`, ...)
* `Promise` (`resolve`, `all`, `allSettled`, `race`, `any`)
* `ArrayBuffer` (`isView`)
* `version` — the engine version string

Iterating a fixed number of times works through the iterable protocol instead
of a `range` helper:

```jinja
{% for i in [0, 1, 2, 3, 4] -%}
  {{ i }},
{%- endfor %}
```

Custom globals (including a reimplementation of `range`/`joiner` tailored to
your app) can be registered via the engine's `globals` config.

## Builtin Filters

The engine ships a curated set of jinja-compatible filters (plus a few of its
own, like `sanitize`). Everything documented below is implemented; filters of
original nunjucks that are not listed here have been removed:

### abs

Return the absolute value of the argument:

**Input**

```jinja
{{ -3 |> abs }}
```

**Output**

```jinja
3
```
### capitalize

Make the first letter uppercase, the rest lower case:

**Input**

```jinja
{{ "This Is A Test" |&gt; capitalize }}
```

**Output**

```jinja
This is a test
```

### default(value, default, [boolean])

(aliased as `d`)

If `value` is strictly `undefined`, return `default`, otherwise `value`. If
`boolean` is true, any JavaScript falsy value will return `default` (false, "",
etc)

**In version 2.0, this filter changed the default behavior of this
  filter. Previously, it acted as if `boolean` was true by default, and any
  falsy value would return `default`. In 2.0 the default is only an `undefined`
  value returns `default`. You can get the old behavior by passing `true` to
  `boolean`, or just use `value or default`.**
### escape (aliased as e)

Convert the characters &, <, >, ‘, and ” in strings to HTML-safe sequences.
Use this if you need to display text that might contain such characters in HTML.
Marks return value as markup string

**Input**

```jinja
{{ "<html>" |&gt; escape }}
```

**Output**

```jinja
&lt;html&gt;
```

### first

Get the first item in an array or the first letter if it's a string:

**Input**

```jinja
{{ items := [1,2,3] }}
{{ items |&gt; first }}

{{ word := 'abc' }}
{{ word |&gt; first }}
```

**Output**

```jinja
1

a
```
### groupby

Group a sequence of objects by a common attribute:

**Input**

```jinja
{{ items := [
        { name: 'james', type: 'green' },
        { name: 'john', type: 'blue' },
        { name: 'jim', type: 'blue' },
        { name: 'jessie', type: 'green' }
    ]
 }}

] }}
    <b>{{ type }}</b> :
    {% for item in items %}
        {{ item.name }}
    {% endfor %}<br>
{% endfor %}
```

**Output**

```jinja
green : james jessie
blue : john jim
```

Attribute can use dot notation to use nested attribute, like `date.year`.

**Input**

```jinja
{{ posts := [
      {
        date: {
          year: 2019
        },
        title: 'Post 1'
      },
      {
        date: {
          year: 2018
        },
        title: 'Post 2'
      },
      {
        date: {
          year: 2019
        },
        title: 'Post 3'
      }
    ]
}}

{% for year, posts in posts |&gt; groupby("date.year") %}
    :{{ year }}:
    {% for post in posts %}
        {{ post.title }}
    {% endfor %}
{% endfor %}
```

**Output**

```jinja
:2018:
Post 2
:2019:
Post 1
Post 3
```

### indent

Indent a string using spaces.
Default behaviour is *not* to indent the first line.
Default indentation is 4 spaces.

**Input**

```jinja
{{ "one\ntwo\nthree" |&gt; indent }}
```

**Output**

```jinja
one
    two
    three
```

Change default indentation to 6 spaces:

**Input**

```jinja
{{ "one\ntwo\nthree" |&gt; indent(6) }}
```

**Output**

```jinja
one
      two
      three
```

Change default indentation to 6 spaces and indent the first line:

**Input**

```jinja
{{ "one\ntwo\nthree" |&gt; indent(6, true) }}
```

**Output**

```jinja
      one
      two
      three
```
### join

Return a string which is the concatenation of the strings in a sequence:

**Input**

```jinja
{{ items := [1, 2, 3] }}
{{ items |&gt; join }}
```

**Output**

```jinja
123
```

The separator between elements is an empty string by default which can
be defined with an optional parameter:

**Input**

```jinja
{{ items := ['foo', 'bar', 'bear'] }}
{{ items |&gt; join(",") }}
```

**Output**

```jinja
foo,bar,bear
```

This  behaviour is applicable to arrays:

**Input**

```jinja
{{ items := [
    { name: 'foo' },
    { name: 'bar' },
    { name: 'bear' }]
] }}

{{ items |&gt; join(",", "name") }}
```

**Output**

```jinja
foo,bar,bear
```

### last

Get the last item in an array or the last letter if it's a string:

**Input**

```jinja
{{ items := [1,2,3] }}
{{ items |&gt; last }}

{{ word := 'abc' }}
{{ word |&gt; last }}
```

**Output**

```jinja
3

c
```

### length

Return the length of an array or string, or the number of keys in an object:

**Input**

```jinja
{{ [1,2,3] |&gt; length }}
{{ "test" |&gt; length }}
{{ {key: value} |&gt; length }}
```

**Output**

```jinja
3
4
1
```

### lower

Convert string to all lower case:

**Input**

```jinja
{{ "fOObAr" |&gt; lower }}
```

**Output**

```jinja
foobar
```
### replace

Replace one item with another. The first item is the item to be
replaced, the second item is the replaced value.

**Input**

```jinja
{{ numbers := 123456 }}
{{ numbers |&gt; replace("4", ".") }}
```

**Output**

```jinja
123.56
```

Insert a replaced item before and after a value, by adding quote marks
and replacing them surrounding an item:

**Input**

```jinja
{{ letters := aaabbbccc }}
{{ letters |&gt; replace("", ".") }}
```

**Output**

```jinja
.a.a.a.b.b.b.c.c.c.

```

Every instance of an item up to a given number (item to be replaced,
item replacement, number to be replaced):

**Input**

```jinja
{{ letters := "aaabbbccc" }}
{{ letters |&gt; replace("a", "x", 2) }}
```
Note in this instance the required quote marks surrounding the list.

**Output**

```jinja
xxabbbccc
```

It is possible to search for patterns in a list to replace:

**Input**

```jinja
{{ letters := "aaabbbccc" }}
{{ letters |&gt; replace("ab", "x", 2) }}
```

**Output**

```jinja
aaxbbccc
```

### reverse

Reverse a string:

**Input**

```jinja
{{ "abcdef" |&gt; reverse }}
```

**Output**

```jinja
fedcba
```

Reverse an array:

**Input**

```jinja
{% for i in [1, 2, 3, 4] |&gt; reverse %}
    {{ i }}
{% endfor %}
```

**Output**

```jinja
4 3 2 1
```

### round

Round a number:

**Input**

```jinja
{{ 4.5 |&gt; round }}
```

**Output**

```jinja
5
```

Round to the nearest whole number (which rounds down):

**Input**

```jinja
{{ 4 |&gt; round(0, "floor") }}
```

**Output**

```jinja
4
```

Specify the number of  digits to round:

**Input**

```jinja
{{ 4.12346 |&gt; round(4) }}
```

**Output**

```jinja
4.1235
```

### sanitize(value, [config])

Sanitizes an HTML fragment with DOMPurify and returns a `SafeString`, so the
cleaned markup is not double-escaped by autoescaping. An optional config
object is forwarded to DOMPurify (for example to extend the allowed tags):

```jinja
{{ userBio |> sanitize({ ALLOWED_TAGS: ['b', 'i', 'p'] }) }}
```

This is the supported way to render user-supplied HTML safely — unlike
`striptags` (removed), it preserves the safe subset of markup instead of
stripping all tags.

### slice

Slice an iterator and return a list of lists containing those items:

**Input**

```jinja
{{ arr := [1,2,3,4,5,6,7,8,9] }}

<div class="columwrapper">
  {%- for items in arr |&gt; slice(3) %}
    <ul class="column-{{ loop.index }}">
    {%- for item in items %}
      <li>{{ item }}</li>
    {%- endfor %}
    </ul>
  {%- endfor %}
</div>
```

**Output**

```jinja
<div class="columwrapper">
    <ul class="column-1">
      <li>1</li>
      <li>2</li>
      <li>3</li>
    </ul>
    <ul class="column-2">
      <li>4</li>
      <li>5</li>
      <li>6</li>
    </ul>
    <ul class="column-3">
      <li>7</li>
      <li>8</li>
      <li>9</li>
    </ul>
</div>
```
### sort(values, reversed, caseSens, attr)

Sort `values` with JavaScript's sort function. If `reversed` is true, result
will be reversed. Sort is case-insensitive by default, but setting `caseSens`
to true makes it case-sensitive. If `attr` is passed, will compare `attr` from
each item.
### sum

Output the sum of items in the array:

**Input**

```jinja
{{ items := [1,2,3] }}
{{ items |&gt; sum }}
```

**Output**

```jinja
6
```

### title

Make the first letter of the string uppercase:

**Input**

```jinja
{{ "foo bar baz" |&gt; title }}
```

**Output**

```jinja
Foo Bar Baz
```

### tojson

Serialize a value to JSON and return a `SafeString`. `<`, `>`, and `&` are
escaped as `\u003c`-style sequences so a literal `</script>` inside a value
cannot break out of a `<script>` context, and the result is not double-escaped
by autoescaping:

**Input**

```jinja
{{ data |> tojson }}
```

With `data` as `{ x: "</script>" }`, the output is
`{"x":"\u003c/script\u003e"}`. `undefined` serializes to the string
`undefined`. This replaces the removed `dump` filter for embedding data
in templates.

### trim

Strip leading and trailing whitespace:

**Input**

```jinja
{{ "  foo " |&gt; trim }}
```

**Output**

```jinja
foo
```

### truncate

Return a truncated copy of the string. The length is specified with the first
parameter which defaults to 255. If the second parameter is true the filter
will cut the text at length. Otherwise it will discard the last word. If the
text was in fact truncated it will append an ellipsis sign ("...").
A different ellipsis sign than "(...)"  can be specified using the third parameter.

Truncate to 3 characters:

**Input**

```jinja
{{ "foo bar" |&gt; truncate(3) }}
```

**Output**

```jinja
foo(...)
```

Truncate to 6 characters and replace "..." with a  "?":

**Input**

```jinja
{{ "foo bar baz" |&gt; truncate(6, true, "?") }}
```

**Output**

```jinja
foo ba ?
```

### upper

Convert the string to upper case:

**Input**

```jinja
{{ "foo" |&gt; upper }}
```

**Output**

```jinja
FOO
```

### urlencode

Escape strings for use in URLs, using UTF-8 encoding.
Accepts both dictionaries and regular strings as well as pairwise iterables.

**Input**

```jinja
{{ "&" |&gt; urlencode }}
```

**Output**

```jinja
%26
```
