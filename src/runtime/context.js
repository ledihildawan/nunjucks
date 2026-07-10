import { keys } from 'remeda';
import { createObj } from '../object/index.js';
import { createEnvironment } from '../environment/index.js';

export function createContext(ctx, blocks, env) {
  const obj = createObj('Context', {
    init: function(ctx, blocks, env) {
      this.env = env || createEnvironment();
      this.ctx = Object.assign({}, ctx);
      this.blocks = {};
      this.exported = [];

      keys(blocks).forEach(name => {
        this.addBlock(name, blocks[name]);
      });
    },
    lookup: function(name) {
      if (name in this.env.globals && !(name in this.ctx)) {
        return this.env.globals[name];
      }
      return this.ctx[name];
    },
    setVariable: function(name, val) {
      this.ctx[name] = val;
    },
    getVariables: function() {
      return this.ctx;
    },
    addBlock: function(name, block) {
      this.blocks[name] = this.blocks[name] || [];
      this.blocks[name].push(block);
      return this;
    },
    getBlock: function(name) {
      if (!this.blocks[name]) {
        const err = new Error('unknown block "' + name + '"');
        err.code = 'UNDEFINED_BLOCK';
        err.subject = name;
        throw err;
      }
      return this.blocks[name][0];
    },
    getSuper: function(env, name, block, frame, runtime) {
      const idx = (this.blocks[name] || []).indexOf(block);
      const blk = this.blocks[name][idx + 1];

      if (idx === -1 || !blk) {
        const err = new Error('no super block available for "' + name + '"');
        err.code = 'NO_SUPER_BLOCK';
        err.subject = name;
        throw err;
      }

      return blk(env, this, frame, runtime);
    },
    addExport: function(name) {
      this.exported.push(name);
    },
    getExported: function() {
      const exported = {};
      this.exported.forEach((name) => {
        exported[name] = this.ctx[name];
      });
      return exported;
    },
  });
  obj.init(ctx, blocks, env);
  return obj;
}
