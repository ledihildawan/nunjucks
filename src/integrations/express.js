import path from 'node:path';
import { readFile } from 'node:fs/promises';
import EventEmitter from 'events';
import nunjucks from '../index.js';
import { createFileSystemLoader } from '../loaders/index.js';
import { createTemplate } from '../template/index.js';
import { ERROR_DEFINITIONS } from '@nunjucks/log/error/messages';
import { createLog } from '@nunjucks/log';

export function createEngine(config = {}) {
  return function nunjucksExpressEngine(filePath, options, callback) {
    const viewsPath = path.dirname(filePath);
    const loader = createFileSystemLoader(viewsPath, { noCache: config.dev || false });
    
    const emitter = new EventEmitter();
    
    const env = {
      opts: { dev: config.dev || false, autoescape: true, ...config },
      extensionsList: [],
      globals: {},
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
        const template = createTemplate(source.src, this, source.path, eagerCompile, includeChain);
        template.tmplStr = source.src;
        return template;
      }
    };
    
    const templateName = path.basename(filePath);
    const envWithPath = Object.create(env);
    envWithPath.templatePath = filePath;
    const renderConfig = { ...config, templatePath: filePath };
    nunjucks.renderWithEnv(templateName, envWithPath, options, renderConfig)
      .then(html => callback(null, html))
      .catch(async err => {
        if (!err.sourceContent && err.templateName) {
          try {
            const templatePath = err.templateName.replace(/\//g, path.sep);
            err.sourceContent = await readFile(templatePath, 'utf-8');
          } catch (e) {
          }
        }
        callback(err);
      });
  };
}
