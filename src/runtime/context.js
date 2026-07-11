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
      this._parentBlockNames = null;
      this._validatedBlocks = false;

      keys(blocks).forEach(name => {
        this.addBlock(name, blocks[name]);
      });
    },
    validateBlocks: function() {
      if (this._validatedBlocks) return;
      this._validatedBlocks = true;

      if (this._parentBlockNames !== null) {
        const parentBlockNames = new Set(this._parentBlockNames);
        const childOnlyBlocks = keys(this.blocks).filter(name => !parentBlockNames.has(name));
        if (childOnlyBlocks.length > 0) {
          const err = new Error('Block "' + childOnlyBlocks[0] + '" is not defined in parent template');
          err.code = 'UNDEFINED_BLOCK';
          err.subject = childOnlyBlocks[0];
          throw err;
        }
      }
    },
    setParentBlockNames: function(names) {
      this._parentBlockNames = names;
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
      this.validateBlocks();
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
