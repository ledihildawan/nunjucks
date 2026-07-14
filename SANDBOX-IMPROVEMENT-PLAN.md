# SANDBOX IMPROVEMENT PLAN

## Current State Analysis

| File | Lines | Current Status |
|------|-------|---------------|
| `src/runtime/sandbox.js` | 95 | Basic Proxy protection |
| `src/shared/blocked-keys.js` | 35 | 13 blocked keys, 11 dangerous globals |
| `src/config/global.js` | 72 | `sandbox: false` default |

---

## IMPROVEMENT #5 (Hardest): Allowlist-Based Sandboxing

### Solution
Add **allowlist mode** - only permit access to explicitly whitelisted objects/properties.

### Files to Modify
- `src/config/global.js` - Add `sandboxAllowlist: []` option
- `src/runtime/sandbox.js` - Add `isAllowedKey()`, modify Proxy handlers
- `src/runtime/sandbox.test.js` - Add allowlist tests

---

## IMPROVEMENT #4: Block Code Execution Vectors

### Solution
Block `setTimeout(fn, 0)` pattern and similar timing attacks.

### Files to Modify
- `src/shared/blocked-keys.js` - Add timing attack keys
- `src/runtime/sandbox.js` - Wrap timing functions

---

## IMPROVEMENT #3: Environment-Aware Blocking

### Solution
Only block relevant globals based on environment (Node.js vs Browser vs Deno).

### Files to Modify
- `src/shared/blocked-keys.js` - Separate by environment
- `src/runtime/sandbox.js` - Detect environment and apply correct blocklist

---

## IMPROVEMENT #2: Performance Optimization - Lazy Sandboxing

### Solution
Use **lazy evaluation** - only sandbox when dangerous access is attempted.

### Files to Modify
- `src/runtime/sandbox.js` - Replace recursive sandboxing with lazy Proxy

---

## IMPROVEMENT #1 (Easiest): Developer Warning for Unsandboxed Rendering

### Solution
Add warning in development mode when rendering without sandbox.

### Files to Modify
- `src/core/render.js` - Add dev warning
- `src/config/global.js` - Add `devWarningSandbox: true` option

---

## Implementation Order

| Priority | Improvement | Complexity | Risk | Est. Lines |
|----------|-------------|------------|------|------------|
| #1 | Dev Warning | Easy | Very Low | +10 |
| #2 | Lazy Sandboxing | Medium | Medium | +50/-10 |
| #3 | Env-Aware Blocking | Medium | Low | +50 |
| #4 | Block Code Execution | Medium | Medium | +20 |
| #5 | Allowlist Mode | Hard | High | +40 |
