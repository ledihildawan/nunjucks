# Unit Test Migration Plan

## Overview

Migrate 52 unit test files from `src/**/*.test.js` to `packages/@nunjucks/*/src/**/*.test.ts` with new modular API.

**API Change:** `nodes.value()` namespace pattern → `import { value } from '@nunjucks/nodes'`

---

## Test File Count: 63 total

| Target Package | Test Files | Status |
|----------------|-------------|--------|
| `@nunjucks/nodes` | 1 | Pending |
| `@nunjucks/transformers` | 6 | Pending |
| `@nunjucks/runtime` | 8 | Pending |
| `@nunjucks/compiler` | 4 | Pending |
| `@nunjucks/parser` | 33 | Pending |
| `@nunjucks/log` | 2 | Done |
| `main nunjucks` | 9 | Keep in src/ |
| **Total to migrate** | **52** | |

---

## API Migration Reference

### Before (old API)
```javascript
import { nodes } from './index.js';

nodes.value(1, 2, 42);
nodes.getNodeTypeName(n);
nodes.getNodeFields(n);
nodes.findAll('literal');
node.findAll('type');
```

### After (new API)
```typescript
import { value } from '@nunjucks/nodes';
import { getType, getFields_, findAll } from '@nunjucks/nodes/traverse';

value(1, 2, 42);
getType(n);
getFields_(n);
findAll(node, 'literal');
```

### Import Path Changes
| Old | New |
|-----|-----|
| `import { nodes } from './index.js'` | `import { node, value, ... } from '@nunjucks/nodes'` |
| `import { nodes } from '../nodes/index.js'` | `import { node, value, ... } from '@nunjucks/nodes'` |
| `nodes.getNodeTypeName(n)` | `import { getType } from '@nunjucks/nodes/traverse'` |
| `nodes.getNodeFields(n)` | `import { getFields_ } from '@nunjucks/nodes/traverse'` |
| `nodes.findAll(n, 'type')` | `import { findAll } from '@nunjucks/nodes/traverse'` |
| `./walk.js` | `@nunjucks/transformers/walk` |
| `./frame.js` | `@nunjucks/runtime/frame` |
| `./emitters.js` | `@nunjucks/compiler/emit` |

---

## Phase 1: @nunjucks/nodes (1 file)

**File:** `src/nodes/index.test.js` → `packages/@nunjucks/nodes/src/index.test.ts`

### Export Mapping
```
node, value, literal, symbol, templateData, funCall, pipe, pipeAsync,
lookupVal, slice, optionalChain, optionalCall,
add, sub, mul, div, floorDiv, mod, pow, concat,
not, neg, pos,
and, or, nullishCoalesce, compare, compareOperand,
bitwiseOr, bitwiseAnd, bitwiseXor, bitwiseLShift, bitwiseRShift, bitwiseNot,
increment, decrement,
group, array, dict, pair,
arrayPattern, objectPattern, patternProperty, restPattern, assignmentPattern, hole,
block, if_, inlineIf, for_, macro, caller, call, import_, fromImport, set,
capture, tryCatch, do_, with_, switch_, case_,
templateRef, extends_, include, super_,
spread, walrus, templateLiteral, keywordArgs,
Filter, FilterAsync, LiteralNode,
is, in_, isNode, isValue, isLiteral, isSymbol, isNodeList, isOutput,
isFunCall, isPipe, isFilter, isBlock, isExtends, isInclude, isMacro,
isSet, isIf, isFor, isCompare, isLookupVal, isCallExtension, isCallExtensionAsync,
isDict, isArray, isPair, isConcat, isAdd, isBinOp, isUnaryOp,
isKeywordArgs, isRoot, isTemplateData, isSlice, isPipeAsync, isOptionalChain,
isOptionalCall, isImport, isFromImport, isSwitch, isCase, isCapture,
isTryCatch, isDo, isWith, isCaller, isCall, isSuper, isTemplateRef,
isInlineIf, isOr, isAnd, isNot, isNullishCoalesce, isCompareOperand,
isIn, isIs, isSpread, isWalrus, isTemplateLiteral, isVariableDeclaration,
isVariableAssignment, isCompoundAssignment, isDefineBlock, isGroup,
isSub, isMul, isDiv, isFloorDiv, isMod, isPow, isNeg, isPos,
isArrayPattern, isObjectPattern, isPatternProperty, isRestPattern,
isAssignmentPattern, isHole, isPattern
```

### Additional Exports from traverse
```
getType (alias: getNodeTypeName)
getFields_ (alias: getNodeFields)
walk, findAll, findFirst, count, nodes, filterNodes
```

### Helpers to Add
```
addChild - keep as utility or add to factory
```

---

## Phase 2: @nunjucks/transformers (6 files)

| File | Target |
|------|--------|
| `src/transformers/walk.test.js` | `packages/@nunjucks/transformers/src/walk.test.ts` |
| `src/transformers/symbol-generator.test.js` | `packages/@nunjucks/transformers/src/symbol.test.ts` |
| `src/transformers/super-transforms.test.js` | `packages/@nunjucks/transformers/src/super.test.ts` |
| `src/transformers/statement-transforms.test.js` | `packages/@nunjucks/transformers/src/statement.test.ts` |
| `src/transformers/pipe-transforms.test.js` | `packages/@nunjucks/transformers/src/pipe.test.ts` |
| `src/transformers/index.test.js` | `packages/@nunjucks/transformers/src/index.test.ts` |

---

## Phase 3: @nunjucks/runtime (8 files)

| File | Target |
|------|--------|
| `src/runtime/frame.test.js` | `packages/@nunjucks/runtime/src/frame.test.ts` |
| `src/runtime/context.test.js` | `packages/@nunjucks/runtime/src/context.test.ts` |
| `src/runtime/index.test.js` | `packages/@nunjucks/runtime/src/index.test.ts` |
| `src/runtime/macro.test.js` | `packages/@nunjucks/runtime/src/macro.test.ts` |
| `src/runtime/sandbox.test.js` | `packages/@nunjucks/runtime/src/sandbox.test.ts` |
| `src/runtime/safe-string.test.js` | `packages/@nunjucks/runtime/src/safe-string.test.ts` |
| `src/runtime/member-access.test.js` | `packages/@nunjucks/runtime/src/member-access.test.ts` |
| `src/runtime/render-context.test.js` | `packages/@nunjucks/runtime/src/render-context.test.ts` |

---

## Phase 4: @nunjucks/compiler (4 files)

| File | Target |
|------|--------|
| `src/compiler/emitters.test.js` | `packages/@nunjucks/compiler/src/emitters.test.ts` |
| `src/compiler/index.test.js` | `packages/@nunjucks/compiler/src/index.test.ts` |
| `src/compiler/statement-compiler/index.test.js` | `packages/@nunjucks/compiler/src/statement-compiler.test.ts` |
| `src/compiler/statement-compiler/macro.test.js` | `packages/@nunjucks/compiler/src/statement-compiler-macro.test.ts` |
| `src/compiler/expression-compiler/index.test.js` | `packages/@nunjucks/compiler/src/expression-compiler.test.ts` |

---

## Phase 5: @nunjucks/parser (33 files)

### Postfix Parser (4 files)
| File | Target |
|------|--------|
| `src/parser/postfix-parser/fun-call.test.js` | `packages/@nunjucks/parser/src/postfix-parser/fun-call.test.ts` |
| `src/parser/postfix-parser/lookup.test.js` | `packages/@nunjucks/parser/src/postfix-parser/lookup.test.ts` |
| `src/parser/postfix-parser/dot.test.js` | `packages/@nunjucks/parser/src/postfix-parser/dot.test.ts` |
| `src/parser/postfix-parser/optional.test.js` | `packages/@nunjucks/parser/src/postfix-parser/optional.test.ts` |

### Expression Parser (7 files)
| File | Target |
|------|--------|
| `src/parser/expression-parser/arithmetic.test.js` | `packages/@nunjucks/parser/src/expression-parser/arithmetic.test.ts` |
| `src/parser/expression-parser/logical.test.js` | `packages/@nunjucks/parser/src/expression-parser/logical.test.ts` |
| `src/parser/expression-parser/compare.test.js` | `packages/@nunjucks/parser/src/expression-parser/compare.test.ts` |
| `src/parser/expression-parser/concat.test.js` | `packages/@nunjucks/parser/src/expression-parser/concat.test.ts` |
| `src/parser/expression-parser/inline.test.js` | `packages/@nunjucks/parser/src/expression-parser/inline.test.ts` |
| `src/parser/expression-parser/primary.test.js` | `packages/@nunjucks/parser/src/expression-parser/primary.test.ts` |
| `src/parser/expression-parser/spread.test.js` | `packages/@nunjucks/parser/src/expression-parser/spread.test.ts` |

### Statement Parser (11 files)
| File | Target |
|------|--------|
| `src/parser/statement-parser/for.test.js` | `packages/@nunjucks/parser/src/statement-parser/for.test.ts` |
| `src/parser/statement-parser/if.test.js` | `packages/@nunjucks/parser/src/statement-parser/if.test.ts` |
| `src/parser/statement-parser/switch.test.js` | `packages/@nunjucks/parser/src/statement-parser/switch.test.ts` |
| `src/parser/statement-parser/macro.test.js` | `packages/@nunjucks/parser/src/statement-parser/macro.test.ts` |
| `src/parser/statement-parser/import.test.js` | `packages/@nunjucks/parser/src/statement-parser/import.test.ts` |
| `src/parser/statement-parser/extends.test.js` | `packages/@nunjucks/parser/src/statement-parser/extends.test.ts` |
| `src/parser/statement-parser/with.test.js` | `packages/@nunjucks/parser/src/statement-parser/with.test.ts` |

### Parser Index (2 files)
| File | Target |
|------|--------|
| `src/parser/index.test.js` | `packages/@nunjucks/parser/src/index.test.ts` |

---

## Files to Keep in src/ (9 files)

These tests depend on full environment/integration:

| File | Reason |
|------|--------|
| `src/core/*.test.js` (8 files) | Full environment tests |
| `src/filters/*.test.js` | Filter-specific tests |
| `src/loaders/*.test.js` | Loader integration tests |
| `src/object/index.test.js` | Object utils |
| `src/helpers/*.test.js` | Helper tests |

---

## Execution Steps

1. **Phase 1:** Migrate `@nunjucks/nodes` tests
   - Create test file with new imports
   - Run `bun test packages/@nunjucks/nodes/src/`
   - Verify pass

2. **Phase 2:** Migrate `@nunjucks/transformers` tests
   - Run `bun test packages/@nunjucks/transformers/src/`
   - Verify pass

3. **Phase 3:** Migrate `@nunjucks/runtime` tests
   - Run `bun test packages/@nunjucks/runtime/src/`
   - Verify pass

4. **Phase 4:** Migrate `@nunjucks/compiler` tests
   - Run `bun test packages/@nunjucks/compiler/src/`
   - Verify pass

5. **Phase 5:** Migrate `@nunjucks/parser` tests
   - Run `bun test packages/@nunjucks/parser/src/`
   - Verify pass

6. **Phase 6:** Verify full test suite
   - Run `bun test src/` for remaining integration tests
   - Run all 855 tests pass

7. **Phase 7:** Delete old test files
   - Remove `src/**/*.test.js` files that were migrated

---

## Verification Commands

```bash
# Test individual packages
bun test packages/@nunjucks/nodes/src/
bun test packages/@nunjucks/transformers/src/
bun test packages/@nunjucks/runtime/src/
bun test packages/@nunjucks/compiler/src/
bun test packages/@nunjucks/parser/src/

# Full test suite
bun test src/

# Count tests
bun test src/ 2>&1 | tail -5
```

---

## Success Criteria

- [ ] All 52 test files migrated
- [ ] All 855 tests pass
- [ ] No deprecated imports in new test files
- [ ] Old test files deleted from src/
