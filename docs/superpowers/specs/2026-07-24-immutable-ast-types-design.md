# Immutable AST Type Foundations

## Goal

Make the AST foundation type-safe and functional by replacing mutable child insertion and open-ended node shapes with explicit, immutable node operations.

## Scope

This phase covers `@nunjucks/nodes`, direct parser AST construction, and transformer purity. It preserves template parsing and transformation behaviour, but intentionally removes the public mutable `pushChild` API.

## Architecture

The public `Node` union will expose only fields that are valid for each node family. Shared traversal helpers will use discriminated node types and a typed field model rather than arbitrary record indexing. Node factories will keep their current public creator names while returning precise variants.

`appendChild(list, child)` will replace `pushChild(list, child)`. It returns a new node and child array, leaving the prior AST intact. Parser loops will rebind their local aggregate node to each returned value. Existing copy-on-write traversal remains the transformation primitive and will be tightened to avoid mutation and scattered casts.

## Data Flow

Lexer tokens flow to parser creators, which construct immutable AST nodes. Transformers consume an AST and return either the original reference for unchanged subtrees or a structurally shared replacement. Compiler consumers continue receiving the same semantic tree shape.

## Error Handling and Compatibility

Parser failures remain unchanged. Invalid runtime values at public traversal boundaries continue to be rejected by type guards. `pushChild` is removed rather than retained as a compatibility alias, because its mutation semantics violate the new contract; consumers must use `appendChild`.

## Testing

Tests will prove that `appendChild` returns a distinct node without changing the original, parser-created aggregates preserve their existing syntax behaviour, and traversal/transformer operations do not mutate their inputs. Typecheck, lint, and the full Bun test suite are required.

## Out of Scope

This phase does not redesign every AST variant into one interface per individual node type, change template syntax, or refactor compiler and runtime packages beyond any type fallout caused by the public AST contract.
