import EventEmitter from 'events';
import { createCompiler } from '../compiler/index.js';
import { parse } from '../parser/index.js';
import { transform } from '../transformers/index.js';
import { execute } from './compiler.js';
import { validateTemplate, validateRenderContext, validateConfig } from './validator.js';
import { withTimeout } from '../runtime/timeout.js';
import { createSandboxedContext } from '../runtime/sandbox.js';
import { createLog, injectWarningsScript } from '@nunjucks/log';
import { createFileSystemLoader } from '../loaders/index.js';
import { getCallerFile } from '@nunjucks/shared/caller-file';
import { ERROR_DEFINITIONS } from '@nunjucks/log/error/messages';

let cachedLoader = null;
let cachedViewsPath = null;

const getLoader = (config) => {
  const viewsPath = config.views || config.root;
  if (!viewsPath) return null;

  if (cachedLoader && cachedViewsPath === viewsPath) {
    return cachedLoader;
  }

  cachedLoader = createFileSystemLoader(viewsPath, { noCache: config.dev || false });
  cachedViewsPath = viewsPath;
  return cachedLoader;
};

const positionAtOffset = (text, offset) => {
  const before = text.slice(0, offset);
  const parts = before.split('\n');
  return {
    lineOffset: parts.length - 1,
    col: parts[parts.length - 1].length + 1
  };
};

const templateLocationOffset = (template, templateErrorLine, templateErrorCol) => {
  const templateLines = template.split('\n');
  const line = Number.isInteger(templateErrorLine) ? templateErrorLine : 0;
  const col = Number.isInteger(templateErrorCol) ? templateErrorCol : 0;
  const clampedLine = Math.max(0, Math.min(line, templateLines.length - 1));
  let offset = 0;

  for (let i = 0; i < clampedLine; i++) {
    offset += templateLines[i].length + 1;
  }

  return offset + Math.max(0, Math.min(col, templateLines[clampedLine].length));
};

const findTemplateOccurrence = (content, templateHint, preferredLine) => {
  let best = -1;
  let bestTemplate = templateHint;
  let bestDistance = Infinity;
  const candidates = templateHint.includes('\n')
    ? [templateHint, templateHint.replace(/\n/g, '\r\n')]
    : [templateHint];

  for (const candidate of candidates) {
    let searchFrom = 0;

    while (true) {
      const found = content.indexOf(candidate, searchFrom);
      if (found === -1) break;

      const position = positionAtOffset(content, found);
      const line = position.lineOffset + 1;
      const distance = preferredLine ? Math.abs(line - preferredLine) : 0;
      if (distance < bestDistance) {
        best = found;
        bestTemplate = candidate;
        bestDistance = distance;
      }

      searchFrom = found + 1;
    }
  }

  return best === -1 ? null : { index: best, template: bestTemplate };
};

const findSubjectOccurrence = (content, subject, preferredLine) => {
  if (!subject || typeof subject !== 'string') return null;

  let best = null;
  let bestDistance = Infinity;
  const escaped = subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    { re: new RegExp(`'(${escaped})'`, 'g'), group: 1 },
    { re: new RegExp(`"(${escaped})"`, 'g'), group: 1 },
    { re: new RegExp(`\\b(${escaped})\\b`, 'g'), group: 1 }
  ];

  for (const { re, group } of patterns) {
    let match;
    while ((match = re.exec(content)) !== null) {
      const groupText = match[group];
      if (!groupText) continue;

      const groupOffset = match[0].indexOf(groupText);
      const offset = match.index + groupOffset;
      const position = positionAtOffset(content, offset);
      const line = position.lineOffset + 1;
      const distance = preferredLine ? Math.abs(line - preferredLine) : 0;
      if (distance < bestDistance) {
        best = { line, col: position.col };
        bestDistance = distance;
      }
    }
  }

  return best;
};

const extractCodeContext = (filePath, errorLine, errorCol, templateHint = null, templateErrorLine = null, templateErrorCol = null, subjectHint = null) => {
  try {
    const fs = require('fs');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    let resolvedLine = errorLine;
    let resolvedCol = errorCol;

    const subjectMatch = findSubjectOccurrence(content, subjectHint, errorLine);
    if (subjectMatch) {
      resolvedLine = subjectMatch.line;
      resolvedCol = subjectMatch.col;
    } else if (templateHint && typeof templateHint === 'string') {
      const templateMatch = findTemplateOccurrence(content, templateHint, errorLine);
      if (templateMatch) {
        const targetOffset = templateMatch.index + templateLocationOffset(templateMatch.template, templateErrorLine, templateErrorCol);
        const position = positionAtOffset(content, targetOffset);
        resolvedLine = position.lineOffset + 1;
        resolvedCol = position.col;
      }
    }

    if (resolvedLine < 1 || resolvedLine > lines.length) {
      return null;
    }

    const windowSize = 10;
    let startLine = Math.max(1, resolvedLine - windowSize);
    let endLine = Math.min(lines.length, resolvedLine + windowSize);

    return {
      content: lines.slice(startLine - 1, endLine).join('\n'),
      startLine,
      errorCol: resolvedCol,
      errorLine: resolvedLine
    };
  } catch {
    return null;
  }
};

const wrapWithLog = (err, config, template = null, renderContext = null) => {
  const errLineno = err.lineno;
  const errColno = err.colno;
  const useJsCaller = config.jsCallerErrorLine != null;
  const hasErrorLocation = errLineno !== undefined && errLineno !== null;
  const isInlineTemplate = typeof template === 'string' &&
    (template.includes('{{') || template.includes('{%') || template.includes('{#'));
  const preferJsCallerLocation = !config.templatePath && useJsCaller && isInlineTemplate;
  const templatePath = preferJsCallerLocation
    ? (config.jsCaller || config._callerFile || err.templateName || null)
    : (config.templatePath || err.templateName || (typeof template === 'string' ? config._callerFile : null) || null);
  const phase = err.phase || config.phase || 'render';
  const dev = config.dev ?? false;
  const ide = config.ide ?? 'vscode';
  const timestamp = new Date().toISOString();

  let sourceContent = template;
  let sourceStartLine = 1;
  let resolvedJsCallerLine = config.jsCallerErrorLine ?? null;
  let resolvedJsCallerCol = config.jsCallerErrorCol ?? null;

  if (preferJsCallerLocation && useJsCaller && config.jsCaller) {
    const codeContext = extractCodeContext(
      config.jsCaller,
      config.jsCallerErrorLine,
      config.jsCallerErrorCol,
      template,
      errLineno,
      errColno,
      err.subject
    );
    if (codeContext) {
      sourceContent = codeContext.content;
      sourceStartLine = codeContext.startLine;
      resolvedJsCallerLine = codeContext.errorLine ?? resolvedJsCallerLine;
      resolvedJsCallerCol = codeContext.errorCol ?? resolvedJsCallerCol;
    }
  }

  const lineno = preferJsCallerLocation
    ? (resolvedJsCallerLine ?? config.lineno ?? errLineno ?? null)
    : (hasErrorLocation && errLineno != null ? errLineno : (resolvedJsCallerLine ?? config.lineno ?? null));
  const colno = preferJsCallerLocation
    ? (resolvedJsCallerCol ?? config.colno ?? errColno ?? null)
    : (hasErrorLocation && errColno != null ? errColno : (resolvedJsCallerCol ?? config.colno ?? null));
  const lineBase = preferJsCallerLocation
    ? 'one'
    : (hasErrorLocation ? (err.lineBase ?? 'zero') : (err.lineBase ?? (!hasErrorLocation && useJsCaller ? 'one' : 'zero')));

  const errorDef = {
    name: err.code || 'RENDER_ERROR',
    message: () => err.message,
    pattern: /./,
  };
  const errorObj = createLog('error', errorDef, {}, err.subject, {
    lineno,
    colno,
    phase,
    templateName: templatePath,
    code: err.code,
    lineBase,
    dev,
    ide,
    templatePath,
    sourceContent,
    sourceStartLine,
    renderContext,
    timestamp,
    verbosity: 'full',
    isJsCaller: preferJsCallerLocation,
  });

  return errorObj;
};

export const render = async (template, context = {}, config = {}) => {
  config._callerFile = config._callerFile || getCallerFile();

  if (typeof template !== 'string') {
    const err = createLog('error', ERROR_DEFINITIONS.TEMPLATE_MUST_BE_STRING, {}, null, { phase: 'render' });
    throw wrapWithLog(err, config, template, context);
  }

  const validation = validateConfig(config);
  if (!validation.valid) {
    const validationError = validation.errors[0];
    const err = new Error(validationError.message);
    err.code = validationError.code;
    err.subject = validationError.subject;
    throw wrapWithLog(err, config, template, context);
  }

  const loader = getLoader(config);
  let templateSource = template;
  
  if (loader && !template.includes('{{') && !template.includes('{%') && !template.includes('{#')) {
    try {
      const source = await loader.getSource(template);
      if (source && source.src) {
        templateSource = source.src;
        if (!config.templatePath) {
          config.templatePath = source.path;
        }
      }
    } catch (loaderErr) {
      // Fall back to treating template as inline template string
    }
  }

  const templateValidation = validateTemplate(template, config);
  if (!templateValidation.valid) {
    const err = new Error(templateValidation.errors[0].message);
    throw wrapWithLog(err, config, templateSource, context);
  }

  const contextValidation = validateRenderContext(context, config);
  if (!contextValidation.valid) {
    const err = new Error(contextValidation.errors[0].message);
    throw wrapWithLog(err, config, templateSource, context);
  }

  let code;
  let sourceMapData;
  const looksLikeFile = /\.(njk|js|html|htm|twig|ejs|eta)$/i.test(template);
  const templateName = config.templatePath || (looksLikeFile ? template : config._callerFile);
  try {
    const c = createCompiler(templateName, config.undefined, templateSource);
    const ast = parse(templateSource, config, templateName);
    const transformedAst = transform(ast, [], templateName);
    c.compile(transformedAst);
    code = c.getCode();
    sourceMapData = c.getSourceMap().mappings;
  } catch (err) {
    throw wrapWithLog(err, config, templateSource, context);
  }

  const internalKeys = ['__nunjucks_undefined_mode', 'exports', 'module', 'require', '__dirname', '__filename', 'global', 'globalThis', 'process'];
  const userAllowlist = config.sandboxAllowlist || [];
  const mergedAllowlist = [...new Set([...internalKeys, ...userAllowlist])];
  
  const sandboxOptions = {
    allowlist: mergedAllowlist,
    blocklistMode: config.sandboxMode !== 'allowlist'
  };
  const sandboxedCtx = createSandboxedContext(context, config.sandbox, sandboxOptions);
  sandboxedCtx.__nunjucks_undefined_mode = config.undefined || 'default';

  if (loader && !config.env) {
    const emitter = new EventEmitter();
    config.env = {
      opts: {
        dev: config.dev ?? false,
        autoescape: config.autoescape ?? true,
        undefined: config.undefined ?? 'default'
      },
      extensionsList: [],
      globals: config.globals || {},
      _renderingTemplates: new Set(),
      on: (event, handler) => emitter.on(event, handler),
      emit: (event, ...args) => emitter.emit(event, ...args),
      removeListener: (event, handler) => emitter.removeListener(event, handler),
      async getTemplate(name, eagerCompile, includeChain, ignoreMissing) {
        const source = await loader.getSource(name);
        if (!source) {
          if (ignoreMissing) return null;
          throw createLog('error', ERROR_DEFINITIONS.FILE_NOT_FOUND, { path: name }, name, { phase: 'load' });
        }
        const { createTemplate } = await import('../template/index.js');
        return createTemplate(source.src, this, source.path, eagerCompile, includeChain);
      }
    };
  }

  const runtime = buildRuntime(config);
  const warningsCollector = [];

  let result;
  try {
    const renderPromise = execute(code, sandboxedCtx, {
      ...config,
      runtime,
      warningsCollector,
      templateName,
      sourceMapData,
      renderContext: context
    });

    if (config.executionTimeout > 0) {
      result = await withTimeout(renderPromise, config.executionTimeout);
    } else {
      result = await renderPromise;
    }
  } catch (err) {
    throw wrapWithLog(err, config, templateSource, context);
  }

  if (warningsCollector.length > 0 && (config.dev ?? false)) {
    result = result + injectWarningsScript(warningsCollector, { dev: true, verbosity: 'medium' });
  }

  return result;
};

const buildRuntime = (config) => {
  const filters = config.filters || {};
  const globals = config.globals || {};

  return {
    ...globals,
    ...Object.fromEntries(
      Object.entries(filters).map(([name, fn]) => [
        name,
        function(...args) {
          return fn(...args);
        }
      ])
    )
  };
};

export const renderWithEnv = async (templateName, env, context = {}, config = {}) => {
  const validation = validateConfig(config);
  if (!validation.valid) {
    const validationError = validation.errors[0];
    const err = new Error(validationError.message);
    err.code = validationError.code;
    err.subject = validationError.subject;
    throw wrapWithLog(err, { ...config, templatePath: config.templatePath || templateName, env }, null, context);
  }

  const contextValidation = validateRenderContext(context, config);
  if (!contextValidation.valid) {
    const err = new Error(contextValidation.errors[0].message);
    throw wrapWithLog(err, { ...config, templatePath: config.templatePath || templateName, env }, null, context);
  }

  let template;
  try {
    template = await env.getTemplate(templateName, true, templateName, false);
    
    if (typeof template.render === 'function') {
      const result = await template.render(context);
      return result;
    }
    
    throw createLog('error', ERROR_DEFINITIONS.TEMPLATE_NO_RENDER, {}, null, { phase: 'render' });
  } catch (err) {
    throw wrapWithLog(err, { ...config, templatePath: config.templatePath || templateName, env }, template?.tmplStr ?? null, context);
  }
};
