/** One demo error route: the URL `path`, the `template` it renders, and its `context`. */
export interface ErrorRoute {
  path: string;
  template: string;
  context: Record<string, unknown>;
}

/** A band of error routes sharing an engine boundary `tier`, for the `/errors` index. */
export interface ErrorGroup {
  name: string;
  tier: 'tier 1' | 'tier 2' | 'tier 3' | '—';
  items: Array<{ path: string; desc: string }>;
}

/**
 * Error shape thrown by shell-registered demo filters — carries the catalog `code` and
 * `subject` that the rich error page renders as diagnostics.
 */
export interface EnrichedFilterError extends Error {
  code: string;
  subject: string;
}
