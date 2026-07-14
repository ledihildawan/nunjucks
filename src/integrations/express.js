import path from 'node:path';
import EventEmitter from 'events';
import nunjucks from '../index.js';
import { createFileSystemLoader } from '../loaders/index.js';
import { createTemplate } from '../template/index.js';

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
          const err = new Error(`template not found: ${name}`);
          err.code = 'FILE_NOT_FOUND';
          err.subject = name;
          throw err;
        }
        const template = createTemplate(source.src, this, source.path, eagerCompile);
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
      .catch(err => callback(err));
  };
}
