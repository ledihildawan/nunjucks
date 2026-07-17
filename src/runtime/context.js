import { keys } from 'remeda';
import { createObj } from '../object/index.js';

const Context = Symbol('Context');

const createDefaultEnv = () => ({
  globals: {},
  getFilter: () => null,
  opts: {}
});

export function createContext(ctx, blocks, env, metadata = {}) {
  const obj = createObj({
    name: 'Context',
    init: function(ctxArg, blocksArg, envArg, metadataArg) {
      this.env = envArg || createDefaultEnv();
      this.ctx = { ...ctxArg };
      this.blocks = {};
      this.metadata = metadataArg || {};
      this.blockLocations = this.metadata.blockLocations || {};
      this.exported = [];
      this._parentBlockNames = null;
      this._validatedBlocks = false;
      this._parentContext = null;

      keys(blocks).forEach(name => {
        this.addBlock(name, blocks[name]);
      });
    },
    validateBlocks: function() {
      if (this._validatedBlocks) return;
      this._validatedBlocks = true;

      if (this._parentBlockNames !== null) {
        const parentBlockNames = new Set(this._parentBlockNames);
        const childOnlyBlocks = keys(this.blocks || {}).filter(name => !parentBlockNames.has(name));
        if (childOnlyBlocks.length > 0) {
          const blockName = childOnlyBlocks[0];
          const location = this.blockLocations[blockName] || {};
          const err = new Error(`Block "${blockName}" is not defined in parent template`);
          err.code = 'UNDEFINED_BLOCK';
          err.subject = blockName;
          err.lineno = location.lineno ?? null;
          err.colno = location.colno ?? null;
          err.lineBase = 'zero';
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
    addBlock: function(name, block) {
      this.blocks[name] = this.blocks[name] || [];
      this.blocks[name].push(block);
      return this;
    },
    getBlock: function(name) {
      this.validateBlocks();
      if (!this.blocks[name]) {
        const err = new Error(`unknown block "${name}"`);
        err.code = 'UNDEFINED_BLOCK';
        err.subject = name;
        throw err;
      }
      return this.blocks[name][0];
    },
    getSuper: function(envObj, name, block, frame, runtime) {
      const blockList = this.blocks[name];
      if (!blockList) {
        const err = new Error(`no super block available for "${name}"`);
        err.code = 'NO_SUPER_BLOCK';
        err.subject = name;
        throw err;
      }
      const idx = blockList.indexOf(block);
      const blk = blockList[idx + 1];

      if (idx === -1 || !blk) {
        const err = new Error(`no super block available for "${name}"`);
        err.code = 'NO_SUPER_BLOCK';
        err.subject = name;
        throw err;
      }

      return blk(envObj, this, frame, runtime);
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
    fork: function(data = {}) {
      const childCtx = createContext(data, {}, this.env);
      childCtx._parentContext = this;
      return childCtx;
    },
    getVariables: function() {
      if (this._parentContext) {
        const parentVars = this._parentContext.getVariables();
        return { ...parentVars, ...this.ctx };
      }
      return this.ctx;
    },
  });
  obj[Context] = true;
  obj.init(ctx, blocks, env, metadata);
  return obj;
}

export const isContext = (obj) => obj?.[Context] === true;
