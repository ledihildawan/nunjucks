# Restore `src/` and Express Integration

## Goal

Restore the application-layer `src/` tree removed by `eab0f36f`, while preserving the current package-based TypeScript implementation and restoring a runnable Express integration.

## Scope

- Restore `src/` exactly from commit `14be6458`, the parent state before the deletion.
- Preserve all current working-tree changes in `packages/`.
- Reconcile root package exports and sample imports with the restored TypeScript source entry points.
- Verify the Express adapter with a focused smoke test and run workspace verification.

## Architecture

`src/` remains the public composition layer: engine, configuration, loaders, template API, and framework integrations. `packages/@nunjucks/*` remain independently testable implementation packages consumed by that layer. The Express adapter translates Express's view-engine callback contract into the asynchronous renderer and forwards renderer errors to Express unchanged.

## Safety

The restore uses `14be6458:src` only. It does not reset the branch, replace `packages/`, or discard uncommitted changes. Conflicts are resolved in favor of the current package contracts, because they contain the completed TypeScript hardening work.

## Verification

- TypeScript no-emit check
- Biome lint
- Full Bun test suite
- Express adapter smoke test
