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
        const name = filename || filePath;

        // Emit 'update' event on each loader - Environment will catch this
        // and properly invalidate the cache, then emit its own 'update' event
        this.env.loaders.forEach(loader => {
          if (typeof loader.emit === 'function') {
            loader.emit('update', name, filePath);
          }
        });

        console.log(`[Nunjucks] Hot-reloaded: ${name}`);
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