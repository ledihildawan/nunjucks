---
layout: subpage
title: Templates
---
{% raw %}

# 模板

这里包括 Nunjuck 所有可用的功能。

> Nunjucks 是
> [jinja2](http://jinja.pocoo.org/docs/) 的 javascript 的实现，所以如果此文档有什么缺失，你可以直接查看 [jinja2 的文档](http://jinja.pocoo.org/docs/templates/)，不过两者之间还存在一些[差异](http://mozilla.github.io/nunjucks/cn/faq.html)。

## 文件扩展名

虽然你可以用任意扩展名来命名你的Nunjucks模版或文件，但Nunjucks社区还是推荐使用`.njk`。

如果你在给Nunjucks开发工具或是编辑器上的语法插件时，请记得使用`.njk`扩展名。

## 变量

变量会从模板上下文获取，如果你想显示一个变量可以：

```jinja
{{ username }}
```

会从上下文查找 `username` 然后显示，可以像 javascript 一样获取变量的属性 (可使用点操作符或者中括号操作符)：

```jinja
{{ foo.bar }}
{{ foo["bar"] }}
```

如果变量的值为 `undefined` 或 `null`，默认 (chainable) 模式下会显示字面量字符串
`undefined`。引擎的 `undefined` 选项可以控制该行为：

* `chainable`（默认）—— 显示 `undefined`，并允许链式访问（`a` 缺失时
  `{{ a.b.c }}` 仍可继续）
* `strict` —— 第一次访问未定义变量即抛出 `UNDEFINED_VARIABLE`
* `debug` —— 渲染行为与 chainable 相同，但每次未定义访问都会发出警告
* `default` —— 渲染行为与 chainable 相同

可以使用空值合并运算符来提供后备值：`{{ nickname ?? username ?? "anonymous" }}`。

## 过滤器

过滤器是一些可以执行变量的函数，通过管道操作符 (`|>`) 调用，并可接受参数。

```jinja
{{ foo |> title }}
{{ foo |> join(",") }}
{{ foo |> replace("foo", "bar") |> capitalize }}
```

第三个例子展示了链式过滤器，最终会显示 "Bar"，第一个过滤器将 "foo" 替换成 "bar"，第二个过滤器将首字母大写。

Nunjucks 提供了一些[内置的过滤器](#内置的过滤器)，你也可以[自定义过滤器](api#custom-filters)。

## 模板继承

模板继承可以达到模板复用的效果，当写一个模板的时候可以定义 "blocks"，子模板可以覆盖他，同时支持多层继承。

如果有一个叫做 `parent.html` 的模板，如下所示：

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

然后再写一个模板继承他

```jinja
{% extends "parent.html" %}

{% block left %}
This is the left side!
{% endblock %}

{% block right %}
This is the right side!
{% endblock %}
```

以下为渲染结果

```jinja
This is the default content

<section class="left">
  This is the left side!
</section>

<section class="right">
  This is the right side!
</section>
```

你可以将继承的模板设为一个变量，这样就可以动态指定继承的模板。这个变量既可以是个指向模板文件的字符串，也可以是个模板编译后所生成的对象(需要添加上下文环境)。因此你可以通过设置上下文变量，从而在渲染时动态地改变所要继承的模板。

```jinja
{% extends parentTemplate %}
```

继承功能使用了 [`extends`](#extends) 和 [`block`](#block) 标签，[jinja2 文档](http://jinja.pocoo.org/docs/templates/#template-inheritance)中有更细节的描述。

### super

你可以通过调用`super`从而将父级区块中的内容渲染到子区块中。如果在前面的例子中你的子模板是这样的：

```jinja
{% block right %}
{{ super() }}
Right side!
{% endblock %}
```

这个区块的渲染结果将是：

```
This is more content
Right side!
```

## 标签

标签是一些特殊的区块，它们可以对模板执行一些操作。Nunjucks 包含一些内置的标签，你也可以[自定义](api.html#custom-tags)。

### if

`if` 为分支语句，与 javascript 中的 `if` 类似。

```jinja
{% if variable %}
  It is true
{% endif %}
```

如果 `variable` 定义了并且为 true _(译者注：这里并非布尔值，和 javascript 的处理是一样的)_ 则会显示 "It is true"，否则什么也不显示。

```jinja
{% if hungry %}
  I am hungry
{% elif tired %}
  I am tired
{% else %}
  I am good!
{% endif %}
```

在[内联表达式](#if-表达式)(inline expression)中也可以使用 if。

### for

`for` 可以遍历数组 (arrays) 和对象 (dictionaries)。

返回 Promise 的过滤器会被透明地等待 —— 普通的 `for` 循环配合异步过滤器
无需任何改动即可使用，不需要特殊的循环标签。

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

上面的示例通过使用`items`数组中的每一项的`title`属性显示了所有文章的标题。如果`items`数组是空数组的话则会渲染`else`语句中的内容。

你还可以遍历对象：

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

除此之外，Nunjucks 会将数组解开，数组内的值对应到变量 (*new in 0.1.8*)

```js
var points = [[0, 1, 2], [5, 6, 7], [12, 13, 14]];
```

```jinja
{% for x, y, z in points %}
  Point: {{ x }}, {{ y }}, {{ z }}
{% endfor %}
```

在循环中可获取一些特殊的变量

* `loop.index`: 当前循环数 (1 indexed)
* `loop.index0`: 当前循环数 (0 indexed)
* `loop.revindex`: 当前循环数，从后往前 (1 indexed)
* `loop.revindex0`: 当前循环数，从后往前 (0 based)
* `loop.first`: 是否第一个
* `loop.last`: 是否最后一个
* `loop.length`: 总数
### component

`component` 定义可复用、可参数化的内容块 —— 是已移除的 `macro` 标签的替代品。
在组件体内，`{{ children }}` 渲染调用方传入的主体，`{{ slot("name") }}` 渲染
具名插槽：

```jinja
{% component field(name, type='text') %}
<div class="field">
  <input type="{{ type }}" name="{{ name }}" />
</div>
{% endcomponent %}
```

组件可以像普通函数一样调用（默认值和关键字参数均可用，见
[关键字参数](#关键字参数)），也可以通过 `{% render %}` 携带主体调用：

```jinja
{{ field('user') }}
{{ field('pass', type='password') }}

{% render box("My Box Title") %}
  <p>This is the content inside the box.</p>
{% endrender %}
```

`{% render %}` 与 `{% endrender %}` 之间的所有内容会成为组件内的
`children`；具名插槽在 render 主体中用 `{% slot name %}...{% endslot %}`
填充，在组件体内用 `{{ slot("name") }}` 读取。在顶级作用域定义的组件会被
导出，可以被其他模板 [import](#import)。

### := (海象运算符赋值)

`{% set %}` 标签已被移除。变量的声明和赋值改用海象运算符 `:=`，直接在表达式中完成 ——
绑定时**不会输出**该值：

```jinja
{{ username }}
{{ username := "joe" }}
{{ username }}
```

如果 `username` 初始为 "james"，最终将显示 "james joe"。

可以通过解构模式一次声明多个变量：

```jinja
{{ [x, y, z] := [1, 2, 3] }}
```

在顶级作用域赋值会修改全局上下文中的值；在 `{% scope %}` 或 `for` 等作用域块内
赋值则只影响该作用域 —— 可以用 `{% scope %}` 来刻意隔离声明：

```jinja
{% scope %}
  {{ answer := 42 }}
  inside: {{ answer }}
{% endscope %}
```

只有普通变量和解构模式是合法的赋值目标。对成员表达式赋值（例如
`{{ obj.__proto__ := {} }}`）会在解析阶段被 `WALRUS_TARGET_INVALID` 拒绝，
因此无法通过模板赋值进行原型污染。区块捕获赋值（`{% set x %}...{% endset %}`）
已随 `set` 一并移除 —— 请使用 [`{% capture %}`](#capture) 来捕获可复用的输出。

### extends

`extends` 用来指定模板继承，被指定的模板为父级模板，查看[模板继承](#模板继承)。

```jinja
{% extends "base.html" %}
```

你可以将继承的模板设为一个变量，这样就可以动态指定继承的模板。这个变量既可以是个指向模板文件的字符串，也可以是个模板编译后所生成的对象(需要添加上下文环境)。因此你可以通过设置上下文变量，从而在渲染时动态地改变所要继承的模板。

```jinja
{% extends parentTemplate %}
```

`extends`也可以接受任意表达式，只要它最终返回一个字符串或是模板所编译成的对象：

```jinja
{% extends name + ".html" %}`.
```

### block

区块(`block`) 定义了模板片段并标识一个名字，在模板继承中使用。父级模板可指定一个区块，子模板覆盖这个区块，查看[模板继承](#模板继承)。

```jinja
{% block css %}
<link rel="stylesheet" href="app.css" />
{% endblock %}
```

可以在循环中定义区块

```jinja
{% for item in items %}
{% block item %}{{ item }}{% endblock %}
{% endfor %}
```

子模板可以覆盖 `item` 区块并改变里面的内容。

```jinja
{% extends "item.html" %}

{% block item %}
The name of the item is: {{ item.name }}
{% endblock %}
```

在区块中，你可以调用特殊的`super`函数。它会渲染父级区块中的内容。具体请查看[super](#super)。

### include

`include` 可引入其他的模板，可以在多模板之间共享一些小模板，如果某个模板已使用了继承那么 `include` 将会非常有用。

```jinja
{% include "item.html" %}
```

可在循环中引入模板

```jinja
{% for item in items %}
{% include "item.html" %}
{% endfor %}
```

这一点可以帮助我们把模板切分成更小的部分，从而使得在浏览器上，当我们需要改变页面时，我们可以渲染这些小部分的模板，而非一整个的大的模板。

`include` 可以接受任意表达式，只要它最终返回一个字符串或是模板所编译成的对象: `{% include name + ".html" as obj %}`.

在某些情况下，我们可能希望在模板文件不存在时不要抛出异常。对于这类情况，我们可以使用`ignore missing`来略过这些异常：

```jinja
{% include "missing.html" ignore missing %}
```

被包含的模版自身可以扩展(`extends`)另一个模版（因此你可以让一系列相关联的模版继承同一种结构）。
一个被包含的模版并不会改变包含它的模版的区块结构，它有一个分离的继承树和块级命名空间。换言之，
在渲染时，`include`并不 _不是_ 将被包含模版代码拉取到包含它的模版中的预处理器。相对的，它对被
包含的模版触发了一次的分离渲染，然后再将渲染的结果引入。

### import

`import` 可加载不同的模板，可使你操作模板导出的数据。在模板顶级作用域定义的
[组件 (component)](#component) 会被导出，因此可以在其他模板中复用。（海象声明
是 frame 级作用域，不会被导出。）

被 import 进来的模板没有当前模板的上下文，所以无法使用当前模板的变量，

创建一个叫 `forms.html` 如下所示

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

我们可以 import 这个模板并将模板的输出绑定到变量 `forms` 上，然后就可以使用这个变量了：


```jinja
{% import "forms.html" as forms %}

{{ forms.label('Username') }}
{{ forms.field('user') }}
{{ forms.label('Password') }}
{{ forms.field('pass', type='password') }}
```

也可以使用 `from import` 从模板中 import 指定的值到当前的命名空间：

```jinja
{% from "forms.html" import field, label as description %}

{{ description('Username') }}
{{ field('user') }}
{{ description('Password') }}
{{ field('pass', type='password') }}
```

`import` 可以接受任意表达式，只要它最终返回一个字符串或是模板所编译成的对象: `{% import name + ".html" as obj %}`.

### raw

如果你想输出一些 Nunjucks 特殊的标签 (如 `{{`)，可以使用 `{% raw %}` 将所有的内容输出为纯文本。

### filter

`filter`区块允许我们使用区块中的内容来调用过滤器。不同于使用`|>`语法，它会将区块渲染出的内容传递给过滤器。

```jinja
{% filter title %}
may the force be with you
{% endfilter %}

{% filter replace("force", "forth") %}
may the force be with you
{% endfilter %}
```

### capture

`capture` 将区块的渲染输出缓冲到一个变量中 —— 是已移除的区块捕获赋值
（`{% set x %}...{% endset %}`）的替代品，也是
[组件 (component)](#component) 的一次性替代方案：

```jinja
{% capture greeting %}
  Hello {{ name }}!
{% endcapture %}

{{ greeting |> trim }}
```

捕获到的值是普通字符串，因此可以接过滤器使用，也可以在任何能使用变量的
地方复用。

### switch

`switch` 根据值进行分发，支持 `case` 分支、可选的 `default`，以及空 case
的贯穿 (fall-through)：

```jinja
{% switch status %}
  {% case "active" %}<span class="ok">Active</span>
  {% case "inactive" %}<span class="off">Inactive</span>
  {% default %}<span>Unknown</span>
{% endswitch %}
```

case 标签接受任意表达式（`{% case 5 + 5 %}`）。

### match

`match` 是面向模式的分发：分支可将匹配值绑定到名称，用 `if` 守卫进一步
筛选，`_` 作为通配符：

```jinja
{% match statusCode %}
  {% when 200 %}OK
  {% when code if code >= 500 %}Server error ({{ code }})
  {% when _ %}Other
{% endmatch %}
```

### exec

`exec` 执行一条带副作用的表达式语句（方法调用、变更），目的是其副作用而非
返回值 —— 刻意不使用会输出内容的 `{{ }}` 插值：

```jinja
{% exec items.push("item1") %}
{% exec name.append("!") %}
<p>{{ items |> join(",") }}</p>
```

## 关键字参数

jinja2 使用 Python 的关键字参数，支持函数和过滤器。Nunjucks 会通过一个调用转换 (calling convention) 来支持。

关键字参数如下：

```jinja
{{ foo(1, 2, bar=3, baz=4) }}
```

`bar` 和 `baz` 为关键字参数，Nunjucks 将他们转换成一个对象作为最后一个参数传入，等价于 javascript 的如下调用：

```js
foo(1, 2, { bar: 3, baz: 4})
```

因为这使一个标准的调用转换，所以适用于所有的符合预期的函数和过滤器。查看 [API 章节](api#Keyword-Arguments)获得更多信息。

定义[组件 (component)](#component) 的时候也可以使用关键字参数，定义参数值时可设置默认值。Nunjucks 会自动将关键字参数与组件里定义的值做匹配。

```jinja
{% component foo(x, y, z=5, w=6) %}
{{ x }}, {{ y }}, {{ z }}, {{ w}}
{% endcomponent %}

{{ foo(1, 2) }}        -> 1, 2, 5, 6
{{ foo(1, 2, w=10) }}  -> 1, 2, 5, 10
```

在组件中还可以混合使用位置参数 (positional arguments) 和关键字参数。如示例，你可以将位置参数用作关键字参数：

```jinja
{{ foo(20, y=21) }}     -> 20, 21, 5, 6
```

你还可以用位置参数来替换关键字参数：

```jinja
{{ foo(5, 6, 7, 8) }}   -> 5, 6, 7, 8
```

如下示例，你可以跳过 ("skip") 位置参数：

```jinja
{{ foo(8, z=7) }}      -> 8, , 7, 6
```

## 注释

你可以使用 `{#` and `#}` 来写注释，渲染时将会去除所有的注释。

```jinja
{# Loop through all the users #}
{% for user in users %}...{% endfor %}
```

## 空白字符控制

模板在正常情况会将变量 (variable) 和标签区块 (tag blocks) 周围的空白字符完全输出。有时，你不想输出一些额外的空白字符，但代码又需要一些空白字符来显得整洁。

你可以在开始和结束区块 (start or end block tag) 添加 (`-`) 来去除前面和后面的空白字符。

```jinja
{% for i in [1,2,3,4,5] -%}
  {{ i }}
{%- endfor %}
```

上面准确的输出为 "12345"，`-%}` 会去除标签右侧的空白字符，`{%-` 会去除标签之前的空白字符。

变量也支持同样的语法：`{{-` 去除变量之前的空白字符，`-}}` 去除变量之后的空白字符。

另有两个引擎选项可以全局自动化该控制（默认均关闭）：

* `trimBlocks: true` —— 去除每个区块结束标签（`%}`）后的**一个**换行符，
  不影响变量标签
* `lstripBlocks: true` —— 去除区块开始标签（`{%`）所在行行首的空格/制表符，
  仅当该行之前没有其他内容时生效

```js
nunjucks({ trimBlocks: true, lstripBlocks: true });
```

## 表达式

你可以使用和 javascript 一样的字面量。

* Strings: `"How are you?"`, `'How are you?'`
* Numbers: `40`, `30.123`
* Arrays: `[1, 2, "array"]`
* Dicts: `{ one: 1, two: 2 }`
* Boolean: `true`, `false`

### 运算 (Math)

Nunjucks 支持运算 (但尽量少用，把逻辑放在代码中)，可使用以下操作符：

* Addition: `+`
* Subtraction: `-`
* Division: `/`
* Division and integer truncation: `//`
* Division remainder: `%`
* Multiplication: `*`
* Power: `**`

可以如下使用：

```jinja
{{ 2 + 3 }}       (outputs 5)
{{ 10/5 }}        (outputs 2)
{{ numItems*2 }}
```

### 比较 (Comparisons)

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
* 可使用大括号来分组

Examples:

```jinja
{% if users and showUsers %}...{% endif %}
{% if i == 0 and not hideFirst %}...{% endif %}
{% if (x < 5 or y < 5) and foo %}...{% endif %}
```

### If 表达式

和 javascript 的三元运算符 (ternary operator) 一样，可使用 if 的内联表达式：

```jinja
{{ "true" if foo else "false" }}
```

当 foo 为 true 的时候最终输出 "true" 否则为 "false"，对于获取默认值的时候非常有用：

```jinja
{{ baz(foo if foo else "default") }}
```

### 函数调用 (Function Calls)

如果你传入一个函数，则可以直接调用

```jinja
{{ foo(1, 2, 3) }}
```

### 模板字符串 (Template Literals)

模板中**不支持**正则表达式字面量（`r/.../` 或 `/.../`）。需要拼接字符串时，
可以使用与 JavaScript 完全一致的反引号模板字符串和 `${...}` 插值：

```jinja
{{ `Hello ${name}, you have ${count} items` }}
```

正则仍然可以通过渲染上下文传入的值使用 —— 从宿主传入已编译的 `RegExp`，
配合 `matches` 测试使用：

```jinja
{% if code is matches(pattern) %}
  valid
{% endif %}
```

### 测试 (Tests)

`is` 运算符对值应用谓词；用 `is not` 取反。测试可用于 `if` 块和
[内联 if 表达式](#if-表达式)：

```jinja
{% if count is odd %}odd{% endif %}
{% if name is not defined %}anonymous{% endif %}
{{ "cheap" if price is between(0, 100) else "expensive" }}
```

内置谓词按类别如下：

* **存在性** — `defined`、`undefined`、`null`、`none`、`truthy`、`falsy`
* **布尔** — `true`、`false`、`boolean`
* **数值** — `odd`、`even`、`positive`、`negative`、`zero`、`finite`、`nan`、`divisibleby(n)`、`between(low, high)`
* **原始类型** — `string`、`number`、`integer`、`float`、`bigint`、`symbol`
* **字符串** — `empty`、`blank`、`lower`、`upper`、`alpha`、`alphanumeric`、`numeric`、`startswith(s)`、`endswith(s)`、`contains(x)`、`matches(re)`
* **集合** — `array`、`object`、`iterable`、`asynciterable`、`typedarray`、`buffer`、`Map`、`Set`
* **对象类型** — `function`、`asyncfunction`、`Date`、`RegExp`、`Error`、`URL`、`Promise`
* **相等 / 包含** — `sameas(x)`（严格 `===`）、`equalto(x)`（深度 JSON 相等）、`has(key)`、`hasown(key)`
* **HTML** — `safe`（是 SafeString）、`escaped`（不是 SafeString）

## 自动转义 (Autoescaping)

如果在环境变量中设置了 autoescaping，所有的输出都会自动转义：

```jinja
{{ foo }}           // &lt;span&gt;
```

如果未开启 autoescaping，所有的输出都会如实输出，但可以使用 `escape` 过滤器 (别名 `e`) 来转义。

```jinja
{{ foo }}           // <span>
{{ foo |> escape }}  // &lt;span&gt;
```

## 全局函数 (Global Functions)

原版 nunjucks 的 `range`、`cycler` 和 `joiner` 工具已被移除。模板可见的全局变量是一组
精选并冻结（frozen）的标准内置对象，普通渲染和沙箱渲染中均可用：

* `JSON` (`parse`、`stringify`)
* `Math` (`abs`、`ceil`、`floor`、`round`、`min`、`max`、`PI` 等)
* `Object` (`keys`、`values`、`entries`、`freeze` 等)
* `Array` (`isArray`、`from`、`of` 等)
* `Number` (`isInteger`、`isFinite`、`parseFloat` 等)
* `String` (`fromCharCode` 等)
* `Date` (`now`、`isDate` 等)
* `Promise` (`resolve`、`all`、`allSettled`、`race`、`any`)
* `ArrayBuffer` (`isView`)
* `version` —— 引擎版本号

遍历固定次数可以通过可迭代协议实现，而不需要 `range` 工具：

```jinja
{% for i in [0, 1, 2, 3, 4] -%}
  {{ i }},
{%- endfor %}
```

自定义全局变量（包括按你的应用需求重新实现 `range`/`joiner`）可以通过引擎的
`globals` 配置注册。

## 内置的过滤器

引擎提供一组精选的 jinja 兼容过滤器（外加少量自有过滤器，如 `sanitize`）。
以下文档中的过滤器均为实际已实现；原版 nunjucks 中未列出的过滤器已被移除：

### default(value, default, [boolean])

(简写为 `d`)

如果`value`全等于`undefined`则返回`default`，否则返回`value`。
如果`boolean`为true，则会在`value`为JavaScript中的假值时（比如：false, ""等）返回`default`。

**在2.0版本中，这个过滤器的默认表现与以前有所不同。在之前的版本中，它会把`boolean`的默认值
  设置为true，所以传入任何假值都会返回`default`。在2.0中，默认只有值为`undefined`时会
  返回`default`。如果你仍旧希望保持原来版本的表现的话，你可以给`boolean`传入`true`，或是
  直接使用`value or default`。**

### sort(values, reversed, caseSens, attr)

用JavaScript的排序函数对 `values` 排序。如果 `reversed` 为true，则会返回相反的
排序结果。默认状态下排序不会区分大小写，但你可以将 `caseSens` 设置为true来让排序
区分大小写。我们可以用 `attr` 来指定要比较的属性。

### sanitize(value, [config])

使用 DOMPurify 清洗 HTML 片段并返回 `SafeString`，因此清洗后的标记不会被
自动转义二次转义。可选的配置对象会透传给 DOMPurify（例如扩展允许的标签）：

```jinja
{{ userBio |> sanitize({ ALLOWED_TAGS: ['b', 'i', 'p'] }) }}
```

这是安全渲染用户提供的 HTML 的官方支持方式 —— 与已移除的 `striptags` 不同，
它会保留标记中安全的子集，而不是去掉所有标签。

### tojson(value)

将值序列化为 JSON 并返回 `SafeString`。`<`、`>` 和 `&` 会被转义成
`\u003c` 形式的序列，因此值中的字面 `</script>` 无法跳出 `<script>` 上下文，
且结果不会被自动转义二次转义。`undefined` 会序列化为字符串 `undefined`。
该过滤器取代了已移除的 `dump`，用于在模板中内嵌数据：

```jinja
{{ data |> tojson }}
```

### 其他过滤器

以下为引擎实际内置的其余过滤器（文档同 jinja）：

* [abs](http://jinja.pocoo.org/docs/templates/#abs)
* [capitalize](http://jinja.pocoo.org/docs/templates/#capitalize)
* [escape](http://jinja.pocoo.org/docs/templates/#escape) (简写为`e`)
* [first](http://jinja.pocoo.org/docs/templates/#first)
* [groupby](http://jinja.pocoo.org/docs/templates/#groupby)
* [indent](http://jinja.pocoo.org/docs/templates/#indent)
* [join](http://jinja.pocoo.org/docs/templates/#join)
* [last](http://jinja.pocoo.org/docs/templates/#last)
* [length](http://jinja.pocoo.org/docs/templates/#length)
* [lower](http://jinja.pocoo.org/docs/templates/#lower)
* [replace](http://jinja.pocoo.org/docs/templates/#replace) (第一个参数也可以接受
  JavaScript中的正则表达式)
* [reverse](http://jinja.pocoo.org/docs/templates/#reverse)
* [round](http://jinja.pocoo.org/docs/templates/#round)
* [slice](http://jinja.pocoo.org/docs/templates/#slice)
* [sum](http://jinja.pocoo.org/docs/dev/templates/#sum)
* [title](http://jinja.pocoo.org/docs/templates/#title)
* [trim](http://jinja.pocoo.org/docs/templates/#trim)
* [truncate](http://jinja.pocoo.org/docs/templates/#truncate)
* [upper](http://jinja.pocoo.org/docs/templates/#upper)
* [urlencode](http://jinja.pocoo.org/docs/templates/#urlencode)

你也可以直接[看代码](https://github.com/mozilla/nunjucks/blob/master/nunjucks/src/filters.js)。

{% endraw %}
