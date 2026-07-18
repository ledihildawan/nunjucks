export declare const normalizeDrivePath: (p: string) => string;
export declare const shortenPath: (path: string) => string;
export declare const isBlockedKey: (key: string, env?: 'auto' | 'node' | 'browser' | 'deno') => boolean;
export declare const isDangerousGlobal: (key: string) => boolean;
export declare const isCodeExecutionPattern: (key: string) => boolean;
export declare const getBlockedKeyCategory: (key: string, env?: 'auto' | 'node' | 'browser' | 'deno') => 'object_intrinsic' | 'universal_global' | 'node_global' | 'browser_global' | 'deno_global' | null;
export declare const ENVIRONMENTS: {
  NODE: 'node';
  BROWSER: 'browser';
  DENO: 'deno';
};
export declare const BLOCKED_KEY_CATEGORIES: Readonly<{
  OBJECT_INTRINSICS: string[];
  UNIVERSAL_GLOBALS: string[];
  NODE_GLOBALS: string[];
  BROWSER_GLOBALS: string[];
  DENO_GLOBALS: string[];
  CODE_EXECUTION: string[];
}>;
export declare const BLOCKED_KEYS_LIST: string[];
export declare const DANGEROUS_GLOBALS_LIST: string[];
