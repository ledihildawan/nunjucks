import DOMPurify from 'isomorphic-dompurify';
import { safeString } from '../factory/index.ts';

export interface DomPurifyConfig {
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

export const setDefaultDomPurifyConfig = (config: DomPurifyConfig): void => {
  defaultConfig = config;
};

export const getDefaultDomPurifyConfig = (): DomPurifyConfig => ({ ...defaultConfig });

export const sanitize = (str: unknown, config?: DomPurifyConfig): string => {
  const input = String(str);
  const mergedConfig = { ...defaultConfig, ...config };
  const clean = DOMPurify.sanitize(input, mergedConfig);
  return safeString(clean) as unknown as string;
};
