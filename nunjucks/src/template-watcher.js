import { watch } from 'fs';
import { resolve, normalize } from 'node:path';

export class TemplateWatcher {
  constructor(env) {
    this.env = env;
    this.watchers = new Map();
  }

  watch(filePath) {
    if (this.watchers.has(filePath)) {
      return;
    }

    const normalizedPath = normalize(resolve(filePath));

    const watcher = watch(filePath, (eventType, filename) => {
      if (eventType === 'change') {
        this.env.loaders.forEach(loader => {
          if (loader.cache) {
            for (const [key, tmpl] of Object.entries(loader.cache)) {
              if (tmpl && tmpl.path && normalize(resolve(tmpl.path)) === normalizedPath) {
                loader.cache[key] = null;
                console.log(`[Nunjucks] Cache invalidated: ${key}`);
              }
            }
          }
        });
        console.log(`[Nunjucks] Hot-reloaded: ${filename || filePath}`);
      }
    });

    this.watchers.set(filePath, watcher);
    console.log(`[Nunjucks] Watching: ${filePath}`);
  }

  unwatch(filePath) {
    const watcher = this.watchers.get(filePath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(filePath);
      console.log(`[Nunjucks] Stopped watching: ${filePath}`);
    }
  }

  unwatchAll() {
    for (const [path, watcher] of this.watchers) {
      watcher.close();
    }
    this.watchers.clear();
    console.log('[Nunjucks] Stopped all watchers');
  }
}