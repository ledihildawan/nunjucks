import { entries, isArray } from 'remeda';
import { getConfig } from './config.js';
import { extractIncludeChainFromMessage, extractErrorTemplateName } from './core/extract.js';
import { createErrorData } from './state/error-data.js';
import { toConsoleString } from './formatters/console.js';
import { toHtmlString } from './formatters/html/index.js';

const NO_FS = { readFileSync: () => null };

const createFsResolver = () => {
  let cachedFs = null;
  return {
    resolve: async (injected) => {
      if (injected?.readFileSync) return injected;
      if (cachedFs) return cachedFs;
      cachedFs = await loadFs() || NO_FS;
      return cachedFs;
    },
    getCached: () => cachedFs
  };
};

const loadFs = async () => {
  try {
    const { readFileSync } = await import('node:fs');
    return { readFileSync };
  } catch {
    return null;
  }
};

const getCspNonce = (headers, cspConfig) => {
  if (!cspConfig.enabled) return null;
  if (cspConfig.nonceGenerator) return cspConfig.nonceGenerator();
  return findHeader(headers, cspConfig.nonceHeader);
};

const findHeader = (headers, name) => {
  if (!name || !headers) return null;
  const key = name.toLowerCase();
  for (const [k, v] of entries(headers)) {
    if (k.toLowerCase() === key) return v;
  }
  return null;
};

const parseFallbackLine = (snippet, fallback) => {
  const match = snippet?.match(/\d+/);
  return match ? Number(match[0]) : fallback;
};

const resolveChain = (explicit, fromError, fromMessage) => {
  const chain = explicit ?? fromError;
  if (chain) return isArray(chain) ? chain : [chain];
  return fromMessage;
};

const resolveTemplate = (error, name, path, chain) => {
  const hasChain = chain?.length > 0;
  const resolvedPath = path ?? error.templatePath ?? (name && typeof name === 'string' && !name.includes('.njk') && !name.includes('.html') ? name : null);
  return {
    name: hasChain ? error.path : extractErrorTemplateName(error.message) ?? name,
    path: resolvedPath,
    line: error.lineno !== null ? error.lineno + 1 : null,
    col: error.colno !== null ? error.colno + 1 : null
  };
};

const readSource = async (fs, path) => {
  if (!path) return null;
  try {
    return fs.readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
};

const buildErrorData = async (error, templateName, options, opts, fs) => {
  const chain = resolveChain(options.includeChain, error._includeChain, extractIncludeChainFromMessage(error.message));
  const { name, path, line, col } = resolveTemplate(error, templateName, options.templatePath, chain);
  const sourceFromFile = await readSource(fs, path);
  const sourceContent = options.sourceContent ?? sourceFromFile;
  return createErrorData(error, {
    templateName: name,
    templatePath: path,
    sourceContent,
    includeChain: chain,
    isProduction: !opts.dev,
    line,
    col,
    renderContext: options.renderContext,
    ide: opts.ide,
    version: opts.version,
    jsCaller: options.jsCaller || null,
    jsCallerSource: options.jsCallerSource || null,
    jsCallerErrorLine: options.jsCallerErrorLine || null
  });
};

const createErrorResult = (error, errorData, csp) => ({
  name: 'NunjucksError',
  message: error.message,
  timestamp: errorData.timestamp,
  version: errorData.version,
  code: errorData.code,
  subject: errorData.subject,
  phase: errorData.phase,
  templateName: errorData.templateName,
  templatePath: errorData.templatePath,
  originalError: errorData.originalError,
  classified: errorData.classified,
  csp,
  jsCallerSource: errorData.jsCallerSource,
  jsCallerLines: errorData.jsCallerLines,
  getSrcLine: () => errorData.line,
  getSrcCol: () => errorData.col,
  getDisplayLine: errorData.getDisplayLine,
  getDisplayCol: errorData.getDisplayCol,
  getSrcLineFallback: () => parseFallbackLine(errorData.snippet, errorData.line),
  getDisplayLineFallback: () => parseFallbackLine(errorData.snippet, errorData.line) ?? '?',
  get sourceLine() { return errorData.sourceLine; },
  get renderContext() { return errorData.renderContext; },
  get snippet() { return errorData.snippet; },
  get includeChain() { return errorData.includeChain; },
  get isProduction() { return errorData.isProduction; },
  toConsoleString: () => toConsoleString(errorData),
  toHtmlString: () => toHtmlString({ ...errorData, csp })
});

export const createEnvironment = (options = {}) => {
  const fsResolver = createFsResolver();
  return {
    opts: { ...getConfig(), ...options },
    async formatError(error, templateName, options = {}) {
      const fs = await fsResolver.resolve(this.opts.fs);
      const errorData = await buildErrorData(error, templateName, options, this.opts, fs);
      const csp = getCspNonce(options.requestHeaders, this.opts.csp);
      return createErrorResult(error, errorData, csp);
    }
  };
};

let _defaultEnv = null;

export const getEnvironment = () => {
  if (!_defaultEnv) {
    _defaultEnv = createEnvironment();
  }
  return _defaultEnv;
};

export const renderError = async (error, templateName, options = {}) => {
  const err = await getEnvironment().formatError(error, templateName, options);
  return err.toHtmlString();
};

export const createErrorFormatter = (options = {}) => createEnvironment(options);

export const renderErrorString = async (error, templateString, options = {}) => {
  const err = await getEnvironment().formatError(error, templateString, options);
  return err.toHtmlString();
};
