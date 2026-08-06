# Nunjucks Engineering Guidelines

## Core Principles
- **Clean Code, SOLID, YAGNI, KISS** - Always
- **Functional Programming** - Use FP patterns (pipe, flatMap, map, filter, reduce) over imperative code
- **No overengineering** - Don't add abstraction layers that aren't needed now
- **No premature optimization**

## TypeScript Standards
- **No `any`** - Only as temporary escape hatch for highly dynamic ops
- **Use `unknown`** - For external data, narrow before use
- **Generic types** - All helper/utility functions must use generics

## Naming & Code Quality
- **Self-documenting names** - No comments needed if names are clear
- **No variable shadowing** - Strictly prohibited
- **No import/type aliases** - Unless needed to resolve collisions
- **Remove dead comments** - No redundant/obsolete comments
- **Decompose** - Break complex functions into smaller, traceable units

## File Structure
- **Context-aligned** - Files/folders match their domain
- **Test co-location** - Tests sit next to their target files

## Enforcement
Run before committing:
```
npm run typecheck
npm run lint
npm run test
```
