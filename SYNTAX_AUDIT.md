# Nunjucks Syntax Audit

## Delimiters

| Name | Syntax | Description |
|------|--------|-------------|
| Block Start | `{%` | Start of block tag |
| Block End | `%}` | End of block tag |
| Variable Start | `{{` | Start of expression/output |
| Variable End | `}}` | End of expression/output |
| Comment Start | `{#` | Start of comment |
| Comment End | `#}` | End of comment |

## Data Types

| Type | Syntax | Example |
|------|--------|---------|
| Integer | digits | `42`, `-17` |
| Float | digits.digits | `3.14`, `-0.5` |
| String | `"..."` or `'...'` | `"hello"`, `'world'` |
| Boolean | `true`, `false` | `true`, `false` |
| Null | `none`, `null` | `none` |
| Array | `[...]` | `[1, 2, 3]` |
| Object/Dict | `{...}` | `{a: 1, b: 2}` |
| Regex | `/pattern/flags` | `/\\d+/gi` |
| Template Literal | <code>`...`</code> | `` `hello ${name}` `` |

## Literals & Symbols

| Syntax | Description |
|--------|-------------|
| `identifier` | Symbol/variable reference |
| `123` | Integer literal |
| `3.14` | Float literal |
| `"string"` | String literal (double quotes) |
| `'string'` | String literal (single quotes) |
| `true` / `false` | Boolean literal |
| `none` / `null` | Null value |
| `/regex/flags` | Regular expression |

## Operators

### Arithmetic Operators

| Operator | Syntax | Description |
|----------|--------|-------------|
| Addition | `+` | `a + b` |
| Subtraction | `-` | `a - b` |
| Multiplication | `*` | `a * b` |
| Division | `/` | `a / b` |
| Modulo | `%` | `a % b` |
| Floor Division | `//` | `a // b` (Math.floor(a/b)) |
| Power | `**` | `a ** b` (Math.pow(a,b)) |
| Unary Plus | `+` | `+x` |
| Unary Minus | `-` | `-x` |

### Comparison Operators

| Operator | Syntax | Description |
|----------|--------|-------------|
| Equal | `==` | `a == b` |
| Strict Equal | `===` | `a === b` |
| Not Equal | `!=` | `a != b` |
| Strict Not Equal | `!==` | `a !== b` |
| Less Than | `<` | `a < b` |
| Greater Than | `>` | `a > b` |
| Less or Equal | `<=` | `a <= b` |
| Greater or Equal | `>=` | `a >= b` |
| Chained Compare | `a < b < c` | `a < b and b < c` |

### Logical Operators

| Operator | Syntax | Description |
|----------|--------|-------------|
| And | `and` | `a and b` |
| Or | `or` | `a or b` |
| Not | `not` | `not a` |

### Nullish Operators

| Operator | Syntax | Description |
|----------|--------|-------------|
| Nullish Coalesce | `??` | `a ?? b` |
| Nullish Coalesce Assign | `??=` | `a ??= b` |

### Bitwise Operators

| Operator | Syntax | Description |
|----------|--------|-------------|
| Bitwise Or | `|` | `a \| b` |
| Bitwise And | `&` | `a & b` |
| Bitwise Xor | `^` | `a ^ b` |
| Left Shift | `<<` | `a << b` |
| Right Shift | `>>` | `a >> b` |
| Bitwise Not | `~` | `~a` |

### String/Concat Operators

| Operator | Syntax | Description |
|----------|--------|-------------|
| Concat | `~` | `a ~ b` (string concatenation) |

### Assignment Operators

| Operator | Syntax | Description |
|----------|--------|-------------|
| Simple Assign | `:=` | `x := value` (variable declaration) |
| Walrus | `:=` | `(x := 5)` returns 5 in expression |
| Compound Add | `+=` | `x += 1` |
| Compound Sub | `-=` | `x -= 1` |
| Compound Mul | `*=` | `x *= 2` |
| Compound Div | `/=` | `x /= 2` |
| Compound Mod | `%=` | `x %= 3` |
| Compound Pow | `**=` | `x **= 2` |
| Compound Floor Div | `//=` | `x //= 2` |
| Compound Logical Or | `\|\|=` | `x \|\|= default` |
| Compound Logical And | `&&=` | `x &&= value` |

### Increment/Decrement

| Operator | Syntax | Description |
|----------|--------|-------------|
| Prefix Increment | `++x` | Increment before use |
| Postfix Increment | `x++` | Increment after use |
| Prefix Decrement | `--x` | Decrement before use |
| Postfix Decrement | `x--` | Decrement after use |

### Pipeline Operators

| Operator | Syntax | Description |
|----------|--------|-------------|
| Pipe/Filter | `\|` | `x \| filter` |
| Pipe Forward | `\|>` | `x \|> fn` (functional style) |
| Pipeline Compound Assign | `\|>=` | `x \|>= fn` equivalent to `x = x \|> fn` |

### Optional Chaining

| Operator | Syntax | Description |
|----------|--------|-------------|
| Optional Access | `?.` | `obj?.prop` |
| Optional Call | `?.()` | `obj?.method()` |
| Optional Chain End | `.?` | Ends optional chain |

### Other Operators

| Operator | Syntax | Description |
|----------|--------|-------------|
| Spread | `...` | `...args` in call, `[...arr]` in array |
| Range (inclusive) | `..` | `1..5` |
| Range (exclusive) | `...` | `1...5` |
| Ternary | `? :` | `a ? b : c` |
| In | `in` | `x in array` |
| Is | `is` | `x is defined` |
| Dot Access | `.` | `obj.property` |
| Bracket Access | `[key]` | `obj["key"]` |

## Block Tags ({% ... %})

| Tag | Syntax | Description |
|-----|--------|-------------|
| If | `{% if %}` | Conditional |
| Else If | `{% elseif %}`, `{% elif %}` | Else if branch |
| Else | `{% else %}` | Else branch |
| End If | `{% endif %}` | End conditional |
| For | `{% for %}` | Loop |
| End For | `{% endfor %}` | End loop |
| While | `{% while %}` | While loop |
| End While | `{% endwhile %}` | End while loop |
| Switch | `{% switch %}` | Switch statement |
| Case | `{% case %}` | Case branch |
| Default | `{% default %}` | Default branch |
| End Switch | `{% endswitch %}` | End switch |
| Block | `{% block %}` | Block definition |
| Extends | `{% extends %}` | Template inheritance |
| Include | `{% include %}` | Include template |
| Import | `{% import %}` | Import macro file |
| From Import | `{% from %}` | Import specific macros |
| Macro | `{% macro %}` | Macro definition |
| Call | `{% call %}` | Call macro with body |
| Filter | `{% filter %}` | Apply filter to block |
| Try | `{% try %}` | Try block |
| Catch | `{% catch %}` | Catch exception |
| End Try | `{% endtry %}` | End try |
| Do | `{% do %}` | Execute expression (no output) |
| With | `{% with %}` | Scoped variables |
| End With | `{% endwith %}` | End with block |
| Raw | `{% raw %}` | Raw content (no parsing) |
| Verbatim | `{% verbatim %}` | Raw content (no parsing) |
| Set | `{% set %}` | Variable assignment |

## Special Syntax

### Destructuring

| Syntax | Description |
|--------|-------------|
| `[a, b] := pair` | Array destructuring in walrus |
| `{a, b} := obj` | Object destructuring in walrus |
| `[a, ...rest] := arr` | Array destructuring with rest |
| `{a, ...rest} := obj` | Object destructuring with rest |
| `[a = 1] := arr` | Destructuring with default |
| `{% for [a, b] in pairs %}` | For loop with destructuring |

### Walrus Operator

| Syntax | Description |
|--------|-------------|
| `(x := 5)` | Returns 5, assigns to x |
| `{% if (x := getValue()) %}` | Walrus in condition |
| `([a, b] := pair)` | Array destructuring with walrus |

### Inline If

| Syntax | Description |
|--------|-------------|
| `{{ a if cond else b }}` | Ternary expression |

### Filter Syntax

| Syntax | Description |
|--------|-------------|
| `{{ x \| filter }}` | Apply filter |
| `{{ x \| filter(arg) }}` | Filter with argument |
| `{{ x \| filter1 \| filter2 }}` | Chained filters |
| `{{ x \|> fn }}` | Pipe forward (functional) |

## Supported Node Types

```
- literal, symbol, group
- funCall, lookupVal, optionalChain, optionalCall
- pipe, filter
- unaryOp (not, neg, pos, bitwiseNot)
- binOp (add, sub, mul, div, mod, floorDiv, pow)
- compare, compareOperand
- and, or, nullishCoalesce, in, is
- bitwiseOr, bitwiseAnd, bitwiseXor, bitwiseLShift, bitwiseRShift, bitwiseNot
- increment, decrement
- concat, templateLiteral
- walrus, inlineIf
- variableDeclaration, variableAssignment, compoundAssignment
- array, dict, pair, spread
- arrayPattern, objectPattern, patternProperty, restPattern, assignmentPattern, hole
- slice
- output, templateData
- block, extends, include, import, fromImport
- macro, caller, call, callExtension, callExtensionAsync
- set
- if, switch, case
- for, while
- capture, tryCatch, do, with
- raw, verbatim
- filter (statement)
- defineBlock
- super, templateRef
```

## Complete Operator List (from COMPLEX_OPERATORS)

```
==, ===, !=, !==
<=, >=
//, **
?. (optional access)
?? (nullish coalesce)
.? (optional chain end)
||, &&, |>
||=, &&=, ??=
|>, |>= (pipe, pipe compound assign)
.., ... (ranges/spread)
**=, //=
:= (walrus/declaration)
<<, >> (bitwise shift)
++, -- (increment/decrement)
+=, -=, *=, /=, %= (compound arithmetic)
```
