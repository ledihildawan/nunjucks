import DomPurify from 'isomorphic-dompurify';
import { safeString } from '../factory/index.ts';

interface DomPurifyConfig {
  ALLOWED_TAGS?: string[];
  ALLOWED_ATTR?: string[];
  ALLOWED_DATA_ATTR?: boolean;
  KEEP_CONTENT?: boolean;
  RETURN_DOM?: boolean;
  RETURN_DOM_FRAGMENT?: boolean;
  FORBID_TAGS?: string[];
  FORBID_ATTR?: string[];
  ALLOW_ARIA_ATTR?: boolean;
  ALLOW_DATA_ATTR?: boolean;
}

let defaultConfig: DomPurifyConfig = {};

const setDefaultDomPurifyConfig = (config: DomPurifyConfig): void => {
  defaultConfig = config;
};

const getDefaultDomPurifyConfig = (): DomPurifyConfig => ({ ...defaultConfig });

const sanitize = (str: unknown, config?: DomPurifyConfig): string => {
  const input = String(str);
  const mergedConfig = { ...defaultConfig, ...config };
  const clean = DomPurify.sanitize(input, mergedConfig);
  return safeString(clean) as unknown as string;
};

export { setDefaultDomPurifyConfig, getDefaultDomPurifyConfig, sanitize };
export type { DomPurifyConfig };
