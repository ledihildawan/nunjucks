export interface ErrorRoute {
  path: string;
  template: string;
  context: Record<string, unknown>;
  category: string;
  desc: string;
  filters?: Record<string, (...args: unknown[]) => unknown>;
}

export interface ErrorGroup {
  name: string;
  items: Array<{ path: string; desc: string }>;
}