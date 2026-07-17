export declare const isBlockedKey: (key: string, env?: 'auto' | 'node' | 'browser' | 'deno') => boolean;
export declare const isDangerousGlobal: (key: string) => boolean;
export declare const isCodeExecutionPattern: (key: string) => boolean;
export declare const ENVIRONMENTS: {
  NODE: 'node';
  BROWSER: 'browser';
  DENO: 'deno';
};
export declare const BLOCKED_KEYS_LIST: string[];
export declare const DANGEROUS_GLOBALS_LIST: string[];
