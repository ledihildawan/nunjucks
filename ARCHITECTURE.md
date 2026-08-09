# Project Architecture & Coding Standards

The authoritative, detailed engineering standard for this repository. The
condensed rules in `CLAUDE.md` derive from this document — when in doubt, this
file is the source of truth.

---

## 1. Project Architecture & Design Principles

- **Core Paradigms** — Adhere strictly to Clean Code, SOLID, YAGNI, and KISS principles.
- **Avoid Over-complication** — Avoid premature optimization and overengineering. Code must solve the current domain problem without unnecessary abstraction layers.
- **Functional Programming (FP) First** — FP is the primary design paradigm. Prefer pure functions, immutability, and function composition over OOP class hierarchies.

## 2. Architectural Layering & Functional Taxonomy

To maintain a clear balance between Functional Purity and Pragmatism (KISS/YAGNI), code implementation must follow this usage hierarchy.

### Core / Domain Layer (Everyday Rules)
- Use **Pure Functions, Referential Transparency, and Immutability** for all business logic.
- Use **Functional Core, Imperative Shell** to isolate side-effects.
- Use **Algebraic Data Types (ADTs)** via TypeScript Discriminated Unions for state modeling.
- Use **Map, Filter, Reduce** for collection transformations (traditional `for`/`while` loops are strictly prohibited here).
- Enforce **privacy via Closures and Module Scopes** (OOP access modifiers like `private`/`protected` are prohibited).

### Composition & Logic Flow (Complex Logic Layer)
- Use **Pipeline / Pipe, Currying, Partial Application, and Point-free Style** when composition is needed to keep functions compliant with parameter limits.

### Boundaries & Validation Layer (API, DB, External Payloads)
- Use **Either / Result Types** (or `[err, data]` tuples) for explicit error handling instead of `throw`.
- Use **Validation Accumulators** for payload parsing at input boundaries to collect all validation errors at once.
- Use **Option / Maybe** patterns to handle nullable types safely.
- Isolate database and third-party interactions using the **IO Monad** or dedicated adapter boundaries.

### Optimization & Performance Exemptions (Restricted Loop & Imperative Usage)
- Imperative `for` and `while` loops are **banned** from general application code.
- Imperative loops are only permitted in isolated pure abstractions under three strict scenarios:
  1. **AST Parsers / Compilers / High-Throughput Engines** — where array iteration creates severe memory allocation / Garbage Collection overhead.
  2. **Recursion Safety / Trampolining** — internal stack-based loops to prevent stack overflow in deep tree evaluations.
  3. **Async Time-based Control Flows** — polling mechanisms, retry loops with exponential backoff, or stream processing.
- Use **Memoization, Recursion / Trampolining, or Lazy Evaluation** conditionally for performance or heavy tree traversal.
- Use **Lens / Optics and Pattern Matching** only for deeply nested structures or complex state unions.

## 3. Advanced Language Primitives & Metaprogramming

High-performance techniques and advanced primitives must be applied purposefully without obfuscating domain logic.

- **Modern Collections (`Map`, `Set`)** — Preferred over plain objects or arrays for dynamic key-value lookups, high-frequency insertions/deletions (O(1) complexity), or set-theory operations (union, intersection).
- **Memory-Sensitive Structures (`WeakMap`, `WeakSet`)** — Use exclusively for memory-safe utility abstractions (e.g. internal cache/memoization keys, object metadata attachment) to prevent memory leaks via automatic Garbage Collection.
- **Lazy Evaluation & Streaming (`Generator`, `AsyncGenerator`)** — Use for processing large datasets, infinite streams, or chunked batch executions to optimize memory consumption (low RAM footprint).
- **Metaprogramming & Reflection (`Proxy`, `Reflect`, `Symbol`)**:
  - Permitted for framework-level infrastructure, structural reactivity, mocking/stubbing utilities, or transparent logging/tracing decorators.
  - **Strict Isolation** — handlers must remain isolated within infrastructure/utility boundaries and must never obscure core business rules.

## 4. Modular Design & Decomposition

- **Context-Driven Architecture** — Structure folders and files logically by domain context. Refactor structures that no longer align with the evolving domain scope.
- **Semantic Naming** — Directory and file names must strictly match their context and functional purpose.
- **High Cohesion & Single Responsibility** — A module handles exactly one domain capability (e.g. `PaymentGateway` manages payments only).
- **Encapsulation via Scope** — Restrict exports. Keep helper functions internal to file/module scope.
- **Test Co-location** — Keep unit and behavior tests alongside the implementation file they test. Refactor tests immediately whenever implementation changes.

## 5. Function Design & Execution Flow

- **Parameter Limit** — Maximum of 0 to 2 parameters per function. Functions requiring ≥ 3 inputs must use a single strongly-typed options parameter object with destructuring.
- **Purity & Side Effects** — Keep domain logic in Pure Functions (deterministic, zero side effects). Isolate Impure Logic (database calls, network I/O, clock access) to the application boundary layers.
- **Explicit Error Handling** — Avoid throwing unhandled exceptions for expected failure modes. Return explicit error structures (e.g. `[error, data]` tuples or `Result<T, E>` types) to enforce upstream error handling.

## 6. Type Safety & TypeScript Standards

- **Zero `any` Policy** — The `any` type is strictly banned. Use generics, explicit interfaces, or `unknown`.
- **Mandatory Boundary Validation** — External inputs (API requests, MQ payloads, third-party responses) must be typed as `unknown` and parsed at runtime using schema validation libraries (e.g. Zod) before reaching domain logic.
- **Generic Utilities** — Reusable helper functions must leverage TypeScript Generics to enforce strict type inference without losing context.

## 7. Naming Conventions & Readability

- **Strict Semantic Naming** — Variable, function, and parameter names must express domain intent clearly. Generic numeric suffixes (e.g. `node1`, `node2`, `data1`, `item2`) are strictly prohibited. Names must describe the specific role or context (e.g. `leftNode`, `rightNode`, `sourceData`, `targetData`).
- **Self-Explanatory Code** — Code structure and naming must explain intent, eliminating the need for redundant inline comments.
- **No Shadowing & Pseudo-Privates** — Variable shadowing is prohibited. Do not use `_` prefixes for pseudo-private variables; enforce encapsulation via module scope and closure.
- **Unused Parameters** — Use a single `_` or a `_` prefix exclusively for intentionally unused arguments (e.g. `.map((_, index) => ...)`).
- **Modern Syntax Only** — Rely strictly on current, stable language features. Commented-out code and legacy syntax must be removed prior to code review.
