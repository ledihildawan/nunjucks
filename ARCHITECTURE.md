# Project Architecture & Coding Standards

The authoritative, detailed engineering standard for this repository. The
condensed rules in `CLAUDE.md` derive from this document — when in doubt, this
file is the source of truth.

---

## 1. Project Architecture & Design Principles

- **Core Paradigms** — Adhere strictly to Clean Code, SOLID, YAGNI, and KISS principles across all layers.
- **Avoid Over-complication** — Avoid premature optimization and overengineering. Code must solve the current domain problem without introducing unnecessary abstraction layers.
- **Functional Programming (FP) First** — Functional Programming is the primary design paradigm. Prefer pure functions, immutability, and function composition over Object-Oriented Class hierarchies and state mutability.

## 2. Architectural Layering & Functional Taxonomy

Implementation must follow this usage hierarchy to balance Functional Purity with Pragmatism:

### Core / Domain Layer (Everyday Rules)

- Use **Pure Functions, Referential Transparency, and Immutability** for all business logic.
- Use **Functional Core, Imperative Shell** architecture to isolate side-effects from domain calculations.
- Use **Algebraic Data Types (ADTs)** (e.g., Discriminated Unions / Sum Types) for domain state modeling.
- Use **Declarative Collection Transformations** (`map`, `filter`, `reduce`) for data processing. Traditional imperative loops (`for`, `while`) are strictly prohibited in domain code.
- Enforce **data privacy via Scope Encapsulation** (e.g., Closures, Module Scope, Package-private boundaries) instead of class access modifiers (`private`/`protected`).

### Composition & Logic Flow (Complex Logic Layer)

- Use **Function Composition** (Pipelines, Currying, Partial Application, Point-free Style) when chaining operations to keep functions compliant with parameter limits.

### Boundaries & Validation Layer (API, DB, External Payloads)

- Use **Explicit Error Types** (e.g., `Result<T, E>`, `Either`, or `[error, data]` tuples) for expected failure modes instead of throwing unhandled exceptions.
- Use **Validation Accumulators** (e.g., Schema Validators) at boundary inputs to parse external data and accumulate validation errors at once.
- Use **Option / Maybe** patterns or Null-safe wrappers to handle empty values safely.
- Isolate **I/O operations** (Database, Network, File System) within dedicated adapter boundaries.

## 3. Performance Exemptions & Low-Level Primitives

High-performance techniques and advanced language features must be applied purposefully without obfuscating domain logic:

### Restricted Imperative Loops (`for` / `while`)

- **Banned** in general application code.
- Permitted exclusively in low-level abstractions under three strict scenarios:
  1. **Hot-path Performance** — AST Parsers, Compilers, Tokenizers, or High-Throughput Engines where iterator allocations create severe Garbage Collection / Memory overhead.
  2. **Recursion & Memory Safety** — Internal stack-based loops or Trampolining to prevent call stack overflow in deep tree evaluations.
  3. **Async Time-based Control Flows** — Polling mechanisms, retry loops with backoffs, or stream processing.

### Advanced Collections & Data Structures

- Use specialized lookup structures (e.g., `Map`, `Set`, Hash Maps) over plain objects/dictionaries for dynamic key lookups, high-frequency operations (O(1) complexity), or set operations.

### Memory-Sensitive Structures

- Use weak reference structures (e.g., `WeakMap`, `WeakSet`, Ephemerons) exclusively for memory-safe utility abstractions (e.g., internal cache/memoization keys, object metadata attachment) to allow automatic Garbage Collection.

### Lazy Evaluation & Streaming

- Use Generators / Iterators / Streams for processing large datasets, infinite sequences, or chunked batch executions to maintain a minimal RAM footprint.

### Metaprogramming & Reflection

- Features like Reflection, Proxies, Dynamic Interception, and Symbols are permitted for infrastructure, reactivity engines, ORM internals, or logging decorators.
- **Strict Isolation** — Metaprogramming must remain strictly isolated within infrastructure/utility boundaries and must never obscure core business rules.

## 4. Function Design & Execution Flow

### Parameter Limit (Default Rule)

- Maximum of **0 to 2 positional parameters** for general application, domain, and feature code.
- Functions requiring ≥ 3 inputs **MUST** use a single strongly-typed options parameter object (or struct/record with destructuring).

### Exemptions for Low-Level Plumbing & Contracts

Positional parameters > 2 are strictly allowed without options objects **ONLY** in the following architectural boundaries:

1. **Compiler / Parser / Lexer Plumbing** — Hot-path functions where positional arguments avoid object allocation overhead (e.g., `handleInExpression(ctx, node, invert, token)`).
2. **Fixed Framework / Engine Contracts** — Public API contracts dictated by underlying engines or third-party specifications (e.g., Template Engine filter signatures `replace(str, old, new, max)`).
3. **State Machine Transitions** — Low-level state tracking where parameters represent raw execution context (`scan(state, content, depth)`).

### Purity & Side Effects

- Keep domain logic in **Pure Functions** (deterministic, zero side effects). Isolate Impure Logic (database calls, network I/O, system clock) to application boundary layers.

## 5. Type Safety & Language Standards

- **Zero Weak/Dynamic Escape Hatches** — Banned types like `any` (or equivalent untyped dynamic types in statically typed languages). Use Generics, Explicit Interfaces, or Universal Top Types (`unknown`).
- **Mandatory Boundary Validation** — External inputs (API requests, MQ payloads, third-party responses) must enter as `unknown`/untrusted and be parsed at runtime via schema validation before reaching domain logic.
- **Generic Utilities** — Reusable helper functions must leverage Generics / Parametric Polymorphism to enforce strict type inference without losing context.

## 6. Modular Design & Structure

- **Context-Driven Architecture** — Structure folders, packages, and modules logically by domain context rather than technical roles.
- **High Cohesion & Single Responsibility** — A module handles exactly one domain capability (e.g., `PaymentGateway` manages payments only).
- **Encapsulation via Scope** — Restrict exports. Keep internal helper functions private to the module/file scope.
- **Test Co-location** — Keep unit and behavior tests alongside the implementation files they target.

## 7. Naming Conventions & Readability

- **Strict Semantic Naming** — Variable, function, and parameter names must express domain intent clearly. Using generic numeric suffixes (e.g., `node1`, `node2`, `data1`, `item2`) is strictly prohibited. Names must describe the specific role or context (e.g., `leftNode`, `rightNode`, `sourceData`, `targetData`).
- **Self-Explanatory Code** — Code structure and naming must explain intent, eliminating the need for redundant inline comments.
- **No Shadowing & Pseudo-Privates** — Variable shadowing is prohibited. Avoid pseudo-private naming conventions (e.g., `_myPrivateVar`); enforce encapsulation via language-level scope mechanism.
- **Unused Parameters** — Use a single `_` or a `_` prefix exclusively for intentionally unused arguments (e.g., `.map((_, index) => ...)`).
- **Modern Syntax Only** — Rely strictly on current, stable language features. Commented-out code and legacy syntax must be permanently removed prior to code review.

## 8. Error Handling & Streaming Error Strategy

Template rendering uses a **two-pass streaming pipeline** (`renderToStream`) with a **three-tier error strategy**. The deciding question for any error is: *does one failing expression make the whole page useless, or only that spot?* Structural/safety failures abort; per-expression data failures render inline.

### Tier 1 — Pre-stream block (full error page)

Failures detected in **pass-1** (`prepareRender`) arrive as `{ ok: false, error }` before any chunk is streamed. Response headers are not yet sent, so the consumer can render a full error page. These always block because the template cannot produce valid output at all:

- **Syntax / parse / compile errors** — malformed `{% %}`, unbalanced blocks, invalid expression grammar.
- **Template source resolution** — file-not-found, filesystem I/O errors, loader failures.
- **Context security violations** — dangerous context values (`eval`, `Function`, `process`) caught by strict mode; blocked context keys.
- **Config / validation errors** — invalid render configuration, oversized templates.

### Tier 2 — Mid-stream inline marker (recoverable)

With `streamErrorRecovery: true`, the compiler emits a per-expression `try/catch` boundary. A failing `{{ expr }}` calls `runtime.streamError()`, which returns a **sentinel** (it does **not** throw) — `createRenderStream` formats it as an inline error marker and the generator **continues** to the next expression. This serves dashboards / partial-data pages where one missing field must not blank the whole view:

- **Data lookups** — `NULL_VALUE`, `UNDEFINED_VARIABLE`, `UNDEFINED_PROPERTY`, `KEY_NOT_FOUND`.
- **Filter input failures** — `FILTER_TYPE_ERROR`, slice/sum/sort filter errors.
- **Non-fatal sandbox access** — `SANDBOX_ACCESS` on a blocked (non-intrinsic) property.

### Tier 3 — Mid-stream fatal throw (abort)

Errors that bypass the per-expression boundary (e.g. `{% extends %}` / `{% include %}` runtime resolution failure) OR whose code is in the **`FATAL_STREAM_CODES` denylist** re-throw out of `streamError`. The generator throws, `createRenderStream` enriches via `wrapWithLog` and re-throws, and the consumer aborts + logs. These never become inline markers because continuing is unsafe or meaningless:

| Code | Reason |
|------|--------|
| `SANDBOX_CODE_EXECUTION` | Code-injection attempt (`eval` / `Function` / string `setTimeout`) — security |
| `CIRCULAR_INCLUDE` | Infinite include loop — structural, would never terminate |
| `TIMEOUT` | Execution budget exceeded — system |

`isFatalStreamError` is **fail-open**: an error without a `.code` (unrecognized or un-enriched) returns `false` and degrades to the Tier-2 inline marker.

### Lifecycle phase is orthogonal to error tier

The `Phase` union (`'compile' | 'render' | 'load' | 'parse'`) tags the **pipeline stage** where an error originated; it does not decide tier. Pass-1 timing naturally routes `compile`/`parse`/`load` into Tier 1, while `render`-phase errors split between Tier 2 and Tier 3 based on `FATAL_STREAM_CODES` + the `streamErrorRecovery` flag. Do not add streaming-tier concepts to `Phase` — keep the two concerns separate.

### Production guardrails (streaming)

The streaming path enforces a layered safety contract; each wrapper propagates `.return()` so abort/timeout/error cannot leave zombie generators:

- **Total deadline** — `executionTimeout` (same knob as blocking) bounds the whole stream wall-clock via `withStreamDeadline`; on expiry it throws `code='TIMEOUT'` (Tier 3).
- **Idle guard** — `timeoutMs` (per-chunk, via `withStreamTimeout`) catches a single stalled chunk; also `code='TIMEOUT'`.
- **Output bound** — `maxOutputSize` trips an `OUTPUT_SIZE_EXCEEDED` circuit breaker in `pipeChunks` (Tier 3) to stop runaway-loop DoS.
- **Backpressure** — `pipeChunks` awaits `write()` (honors `Promise<boolean>`); `waitForDrain` detaches its listener and races the abort signal (no listener leak, no hang).
- **Cleanup cascade** — every wrapper (`withStreamDeadline` → `withStreamTimeout` → `coalesceStream` → `createRenderStream`) has a `try/finally` or for-await cleanup that returns the underlying iterator. `createRenderStream`'s `finally` is the authoritative owner.
- **JSON consumers** — `streamContentType: 'json'` makes Tier-2 sentinels fatal (Tier 3) because an inline marker would corrupt the JSON response.
- **Single-use** — the returned `AsyncGenerator` rejects a second iteration with a clear error.
