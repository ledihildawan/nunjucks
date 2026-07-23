# Nunjucks Sandbox Security Documentation

## Overview

The Nunjucks sandbox provides secure member access isolation using JavaScript Proxy. It prevents malicious code execution through template context by blocking access to dangerous globals, prototype manipulation, and code execution functions.

## Architecture

### Core Components

1. **Proxy-based Isolation** (`packages/@nunjucks/runtime/src/sandbox.ts`)
   - All context property access goes through `createSandboxedContext` which wraps the context in a Proxy
   - Nested objects are wrapped via `createSandboxedObject`
   - Member access is protected via `wrapMemberAccess`

2. **Blocked Keys Management** (`packages/@nunjucks/shared/src/blocked-keys.ts`)
   - `OBJECT_INTRINSICS`: Dangerous object properties (`__proto__`, `constructor`, `prototype`, etc.)
   - `UNIVERSAL_GLOBALS`: Always dangerous (`eval`, `Function`, `Proxy`, `WebAssembly`)
   - `NODE_GLOBALS`: Node.js specific (`process`, `require`, `global`, etc.)
   - `BROWSER_GLOBALS`: Browser specific (`fetch`, `XMLHttpRequest`, `WebSocket`, etc.)
   - `DENO_GLOBALS`: Deno specific (`Deno`, etc.)

3. **Static Analysis** (`packages/@nunjucks/runtime/src/security.ts`)
   - `scanTemplateForDangerousCode`: Scans templates for dangerous patterns (eval, Function, require, import)
   - `validateContextKeys`: Validates context doesn't contain blocked keys

## Security Properties

### Verified via Property-Based Testing

1. **No blocked key is ever accessible**
   - OBJECT_INTRINSICS (`__proto__`, `constructor`, `prototype`) are blocked as own properties
   - UNIVERSAL_GLOBALS (`eval`, `Function`, `Proxy`, etc.) are blocked at top-level context boundary
   - Environment-specific globals blocked based on configured environment

2. **No code execution via eval/Function**
   - `eval()`, `Function()`, `AsyncFunction()`, `GeneratorFunction()` blocked
   - Timing functions with string code (`setTimeout(code, ...)`, `setInterval(code, ...)`) blocked
   - Spawn functions (`spawn`, `exec`, `fork`) blocked

3. **Prototype chain cannot be traversed**
   - `__proto__` access and mutation blocked
   - `constructor.prototype` access blocked
   - Prototype pollution protection via blocked `prototype` key

4. **Symbol access is controlled**
   - `Symbol.toStringTag` allowed (safe well-known symbol)
   - Anonymous symbols blocked
   - Unsafe symbol descriptions (`constructor`, `prototype`, `__proto__`) blocked

5. **Nested objects maintain isolation**
   - Nested objects are wrapped in their own Proxy
   - Functions in nested objects are wrapped with blocking
   - Prototype pollution protection extends to nested objects

## Threat Model

### Protected Against

- **Remote Code Execution**: Blocking `eval`, `Function`, `setTimeout(string)`, etc.
- **Prototype Pollution**: Blocking `__proto__`, `constructor`, `prototype` manipulation
- **Global Access**: Blocking access to `process`, `globalThis`, `window`, etc.
- **Prototype Chain Escape**: Ensuring sandboxed objects can't access原型 chain to escape

### Not Protected Against

- **Static Template Analysis Bypass**: If dangerous code is constructed via string concatenation in the template itself (e.g., `{{ "ev" + "al" }}()`), static regex scanning cannot detect it. The runtime Proxy provides protection.
- **Brute Force Attacks**: Not in scope - rate limiting should be handled at the application layer
- **Denial of Service**: Resource limits should be handled separately

## Key Design Decisions

### Why `hasOwn` Check?

Properties inherited from `Object.prototype` (like `toString`, `valueOf`, `hasOwnProperty`) are NOT blocked because:
- They are safe inherited methods
- Blocking them would break basic JavaScript functionality

### Why Different Blocking at Top-Level vs Nested?

- **Top-level context**: All dangerous globals are blocked (user context should not have access to `process`, `eval`, etc.)
- **Nested objects**: Only prototype pollution vectors and code execution functions are blocked (user's nested data structures are allowed to have keys like `process` or `eval`)

### Why Symbol Blocking?

Symbols can bypass Proxy traps in some edge cases. We block:
- Anonymous symbols (no description)
- Symbols with dangerous descriptions (`constructor`, `prototype`, `__proto__`)
- Well-known safe symbols (`Symbol.toStringTag`) are allowed

## Testing Strategy

### Traditional Tests
- Unit tests for each security function
- Integration tests for sandbox behavior

### Property-Based Tests (fast-check)
- Exhaustive verification of blocked key access
- Fuzzing of symbol access patterns
- Prototype pollution attack vectors
- Nested object isolation verification

### Code Path Analysis
- All property accesses go through Proxy
- No `eval` or `new Function` in compiler output
- Sandboxed objects cannot escape the sandbox

## Usage

```typescript
import { createSandboxedContext, createSandboxedObject } from '@nunjucks/runtime';

// For template rendering - context is sandboxed
const context = createSandboxedContext(userData, true, { environment: 'node' });

// For nested objects
const sandboxed = createSandboxedObject(nestedData, true);
```

## Configuration

### Environment Modes
- `'auto'`: Detects environment automatically
- `'node'`: Blocks Node.js specific globals
- `'browser'`: Blocks browser specific globals
- `'deno'`: Blocks Deno specific globals

### Allowlist Mode
```typescript
// Only allow specific keys (blocklistMode: false)
const sandboxed = createSandboxedContext(data, true, {
  allowlist: ['user', 'name'],
  blocklistMode: false
});
```
