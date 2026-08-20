// WHY: dedicated subpath entry — see src/index.ts for why `formatError` cannot live in
// the root barrel (it is the error-renderer-coupled presentation surface).
export { formatError } from './create-log/format-error.ts';
