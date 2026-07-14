# Migration Plan: All Code to New Compiler

## Objective
Migrate all code to use the NEW compiler (statement-compiler) instead of the OLD compiler (code-gen.js, builder.js, optimizer.js).

---

## Current State

### Files Using OLD Compiler

| File | Usage |
|------|-------|
| `src/template/index.js` | `_compile()` calls `compile()` |
| `src/core/render.js` | calls `compile()` |
| `src/compiler/index.js` | re-exports from code-gen.js |
| `test-block.js` | uses old compile |
| `test-parse.js` | uses old compile |

### Files to Delete (OLD Compiler)

| File | Description |
|------|-------------|
| `src/compiler/code-gen.js` | OLD compile entry point |
| `src/compiler/builder.js` | OLD CodeBuilder class (~1231 lines) |
| `src/compiler/optimizer.js` | OLD optimizer (only used by code-gen.js) |

### Files to Keep (NEW Compiler)

| File | Description |
|------|-------------|
| `src/compiler/statement-compiler/` | NEW statement compiler functions |
| `src/compiler/expression-compiler/` | NEW expression compiler |
| `src/compiler/node-dispatch.js` | Dispatch to statement-compiler |
| `src/compiler/index.js` | Contains `createCompiler()` - the new entry point |

---

## Migration Steps

### Step 1: Update `src/template/index.js`

**Location:** `_compile()` method (lines 262-291)

**Add imports:**
```javascript
import { createCompiler } from '../compiler/index.js';
import { parse } from '../parser/index.js';
import { transform } from '../transformers/index.js';
```

**Remove imports:**
```javascript
// import { compile } from '../compiler/index.js';  // REMOVE
```

**Update `_compile()` method:**
```javascript
_compile: function() {
  // ...
  try {
    if (this.tmplProps) {
      props = this.tmplProps;
    } else {
      // NEW COMPILER PATH
      const c = createCompiler(this.path, this.env.opts.undefined, this.tmplStr);
      const ast = parse(this.tmplStr, this.env.opts, this.path);
      const transformedAst = transform(ast, this.env.extensionsList, this.path);
      c.compile(transformedAst);
      const code = c.getCode();
      const func = new Function(code);
      props = func();
    }
    this.blocks = this._getBlocks(props);
    this.rootRenderFunc = props.root;
    this.compiled = true;
    // ...
  }
}
```

---

### Step 2: Update `src/core/render.js`

**Location:** Line 42

**Add imports:**
```javascript
import { createCompiler } from '../compiler/index.js';
import { parse } from '../parser/index.js';
import { transform } from '../transformers/index.js';
```

**Remove imports:**
```javascript
// import { compile } from '../compiler/index.js';  // REMOVE
```

**Update code:**
```javascript
// OLD:
code = compile(template, [], [], templateName, config);

// NEW:
const c = createCompiler(templateName, config.undefined, template);
const ast = parse(template, config, templateName);
const transformedAst = transform(ast, [], templateName);
c.compile(transformedAst);
code = c.getCode();
```

---

### Step 3: Update `src/compiler/index.js`

**Remove line 10:**
```javascript
// export { compile, compileSync } from './code-gen.js';  // REMOVE
```

**Keep:**
- `createCompiler()`
- `getSourceMap()`
- `getSourceMapFromCompile()`

---

### Step 4: Update Test Files

- `test-block.js` - Update to use `createCompiler` + `parse` + `transform` + `compiler.compile()`
- `test-parse.js` - Update to use `createCompiler` + `parse` + `transform` + `compiler.compile()`

---

### Step 5: Update `src/compiler/index.test.js`

**Check line 2:**
```javascript
import { createCompiler, compile, getSourceMap, getSourceMapFromCompile } from './index.js';
```

**Action:**
- If tests still need `compile`, update to use `createCompiler` approach
- Otherwise, remove `compile` from import

---

### Step 6: Verify

```bash
npm test
```

All tests must pass.

---

### Step 7: Delete OLD Files

1. `src/compiler/code-gen.js`
2. `src/compiler/builder.js`
3. `src/compiler/optimizer.js`

---

### Step 8: Final Verification

```bash
npm test
npm run lint
```

---

## Checklist

- [ ] Step 1: Update src/template/index.js
- [ ] Step 2: Update src/core/render.js
- [ ] Step 3: Update src/compiler/index.js
- [ ] Step 4: Update test files
- [ ] Step 5: Update compiler tests
- [ ] Step 6: Verify (npm test)
- [ ] Step 7: Delete old files
- [ ] Step 8: Final verification

---

## Notes

- The new compiler uses `createCompiler()` + `compiler.compile()` which internally uses `compileDispatch` to call statement-compiler functions
- The new approach is more modular and maintainable
- NO_SUPER_BLOCK error handling works correctly with the new compiler

---

## Related Files

- `src/compiler/statement-compiler/` - NEW statement compiler
- `src/compiler/expression-compiler/` - NEW expression compiler
- `src/compiler/node-dispatch.js` - Dispatch mechanism
- `src/runtime/context.js` - Contains `getSuper()` for NO_SUPER_BLOCK error
