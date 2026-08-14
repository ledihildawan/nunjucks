export interface ErrorRoute {
  path: string;
  template: string;
  context: Record<string, unknown>;
  category: string;
  desc: string;
}

export interface ErrorGroup {
  name: string;
  tier: 'tier 1' | 'tier 2' | 'tier 3' | '—';
  items: Array<{ path: string; desc: string }>;
}

export interface EnrichedFilterError extends Error {
  code: string;
  subject: string;
}
