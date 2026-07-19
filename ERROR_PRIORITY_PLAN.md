# Error Priority System Plan ("Honest Error Reporting")

## Tujuan

Membuat sistem error priority yang **jujur** - menampilkan akar masalah sebenarnya, bukan gejala.

Contoh:
- `obj = null`, `{{ obj.method }}` → sebelum: "Function 'method' is not defined",sesudah: "Cannot access 'method' on null 'obj'"
- `user = {}`, `{{ user.email }}` → sebelum: "Variable 'email' is not defined",sesudah: "Property 'email' not found in 'user'"

---

## Priority Hierarchy (Honest Error)

| Priority | Kondisi | Error Type | Contoh |
|----------|---------|------------|--------|
| 1 (Tertinggi) | Root object null | `NULL_VALUE` | `obj = null`, `{{ obj.method }}` → "Cannot access 'method' on null 'obj'" |
| 2 | Root object undefined | `NULL_VALUE` | `obj = undefined`, `{{ obj.method }}` → "Cannot access 'method' on undefined 'obj'" |
| 3 | Intermediate null | `NULL_VALUE` | `user = { profile: null }`, `{{ user.profile.name }}` → "Cannot access 'name' on null at 'profile'" |
| 4 | Property not found | `UNDEFINED_PROPERTY` | `user = {}`, `{{ user.email }}` → "Property 'email' not found in 'user'" |
| 5 | Variable not defined | `UNDEFINED_VARIABLE` | `{{ undefinedVar }}` → "Variable 'undefinedVar' is not defined" |
| 6 | Not callable | `NOT_CALLABLE` | `x = 42`, `{{ x() }}` → "'x' is not a function" |
| 7 | Filter not found | `UNDEFINED_FILTER` | `{{ x \| unknown }}` → "Filter 'unknown' is not defined" |

---

## Implementation Steps

### Step 1: Modify `src/runtime/member-access.js`

**Problem:** `memberLookup` returns `undefined` silently, losing null parent info.

**Solution:** Return a wrapper object that tracks null info.

```javascript
// Add at top of file
const NULL_MARKER = '__nunjucks_null__';
const PARENT_NAME = '__nunjucks_parent__';

function memberLookup(obj, val, parentName = null) {
  if (obj == null) {
    return { [NULL_MARKER]: true, [PARENT_NAME]: parentName, __access_path__: val };
  }
  // ... existing logic
}

// Helper to check if result indicates null parent
export function isNullAccessResult(val) {
  return val && val[NULL_MARKER] === true;
}

export function getNullParentName(val) {
  return val && val[PARENT_NAME];
}
```

### Step 2: Add Error Types di `packages/@nunjucks/log/src/errors/runtime.ts`

**Possible Causes (harus update):**
- Parent object is **null** or **undefined**
- Check for proper **null checks** before access
- Use **optional chaining** `?.` to safely access

**Suggested Fix Comment:**
- "Use optional chaining `?.` or add null check"

**Suggested Fix Code:**
- `{{ {parent}?.{accessPath} }}`

```typescript
NULL_VALUE: {
  name: 'NULL_VALUE',
  message: "Cannot access '{accessPath}' on {state} '{parent}'",
  pattern: /^Cannot access '([^']+)' on (null|undefined) '([^']+)'$/i,
  category: 'null_value',
  titleTemplate: "Cannot access '{subject}'",
  causes: [
    'Parent object is **null** or **undefined**',
    'Check for proper **null checks** before access',
    'Use **optional chaining** `?.` to safely access'
  ],
  fixCode: "{{ {parent}?.{accessPath} }}",
  fixComment: 'Use optional chaining `?.` or add null check',
  subjectFrom: firstCapture,
  extraFrom: (groups) => ({ accessPath: groups[1] || '', state: groups[2] || '', parent: groups[3] || '' })
},
```

### Step 3: Update `src/runtime/index.js` - `callWrap` function

**Problem:** Tidak bedain apakah `obj` null atau `obj.method` null.

```javascript
import { isNullAccessResult, getNullParentName } from './member-access.js';

export function callWrap(obj, name, displayName, context, args, lineno, colno) {
  // If memberLookup returned null marker, extract parent info
  if (obj && typeof obj === 'object' && obj[NULL_MARKER]) {
    throw createLog('error', ERROR_DEFINITIONS.NULL_VALUE, {
      accessPath: name,
      state: 'null',
      parent: obj[PARENT_NAME] || name
    }, name, { lineno, colno, phase: 'render', lineBase: 'zero' });
  }

  if (!obj) {
    throw createLog('error', ERROR_DEFINITIONS.NULL_VALUE, {
      accessPath: name,
      state: 'null',
      parent: name
    }, name, { lineno, colno, phase: 'render', lineBase: 'zero' });
  }

  if (!isFunction(obj)) {
    throw createLog('error', ERROR_DEFINITIONS.NOT_CALLABLE, {
      name: displayName,
      type: typeof obj
    }, name, { lineno, colno, phase: 'render', lineBase: 'zero' });
  }

  return obj.apply(context, args);
}
```

### Step 4: Update `src/core/compiler.js` - getFilter

**Consolidate 3 getFilter implementations into one.**

Extract to helper function and reuse:

```javascript
function createGetFilter(context, config, createLog, ERROR_DEFINITIONS, filters) {
  const strictPipeInput = config.strictPipeInput ?? false;

  return function getFilter(name, filterLineno, filterColno, inputLineno, inputColno, inputValue) {
    const filterFn = filters[name];
    if (filterFn) return filterFn;

    const ctxFn = context[name] && typeof context[name] === 'function' ? context[name] : null;
    if (ctxFn) return ctxFn;

    const useInputLocation = inputLineno !== undefined && inputColno !== undefined;
    const errorLineno = useInputLocation ? inputLineno : filterLineno;
    const errorColno = useInputLocation ? inputColno : filterColno;

    // Error priority logic (honest error reporting)
    if (inputValue !== undefined) {
      // ... check for UNDEFINED_PROPERTY vs UNDEFINED_VARIABLE logic

      if (isUndefinedInput || strictPipeInput) {
        if (isPropertyLookup && undefinedParentName) {
          throw createLog('error', ERROR_DEFINITIONS.UNDEFINED_PROPERTY, ...);
        }
        throw createLog('error', ERROR_DEFINITIONS.UNDEFINED_VARIABLE, ...);
      }
    }

    throw createLog('error', ERROR_DEFINITIONS.UNDEFINED_FILTER, ...);
  };
}
```

### Step 5: Create Priority Registry di `packages/@nunjucks/log/src/errors/priority.ts` (NEW)

```typescript
export const ERROR_PRIORITY = {
  NULL_VALUE: 1,              // Most specific - root is null
  UNDEFINED_PROPERTY: 2,     // Property not found on object
  UNDEFINED_VARIABLE: 3,      // Variable not defined
  NOT_CALLABLE: 4,           // Value is not a function
  UNDEFINED_FILTER: 5,       // Filter not registered
  KEY_NOT_FOUND: 6,          // Key not in scope
  // ... others
} as const;

export function getMostHonestError(errors: ErrorCandidate[]): ErrorCandidate {
  return errors.sort((a, b) =>
    (ERROR_PRIORITY[a.type] ?? 999) - (ERROR_PRIORITY[b.type] ?? 999)
  )[0];
}
```

### Step 6: Update Tests

**Files to update:**
- `src/compiler/expression-compiler/pipe.test.js` - sudah ada, perlu update untuk null cases
- Tambah test baru untuk edge cases:
  - `obj = null`, `{{ obj.method }}` → NULL_VALUE
  - `obj = null`, `{{ obj.method() }}` → NULL_VALUE
  - `user = { profile: null }`, `{{ user.profile.name }}` → NULL_VALUE
  - `obj = {}`, `{{ obj.method() }}` → UNDEFINED_PROPERTY

---

## Files Summary

| File | Action |
|------|--------|
| `src/runtime/member-access.js` | Modify - track null parent info |
| `packages/@nunjucks/log/src/errors/runtime.ts` | Add NULL_VALUE error type |
| `src/runtime/index.js` | Update callWrap for NULL_VALUE |
| `src/core/compiler.js` | Centralize getFilter |
| `packages/@nunjucks/log/src/errors/priority.ts` | Create priority registry |

---

## Expected Outcomes

```
{{ obj.method() }}  where obj = null
Before: "Function 'method' is not defined" ❌
After:  "Cannot access 'method' on null 'obj'" ✅

{{ user.profile.name }}  where user = { profile: null }
Before: "Variable 'name' is not defined" ❌
After:  "Cannot access 'name' on null at 'profile'" ✅

{{ user.email }}  where user = {}
Before: "Variable 'email' is not defined" ❌
After:  "Property 'email' not found in 'user'" ✅
```
