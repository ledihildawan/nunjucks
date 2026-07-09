import { keys } from 'remeda';
import { Obj } from './object.js';
import { Environment } from './environment/index.js';

export class Context extends Obj {
  init(ctx, blocks, env) {
    this.env = env || new Environment();
    this.ctx = Object.assign({}, ctx);
    this.blocks = {};
    this.exported = [];

    keys(blocks).forEach(name => {
      this.addBlock(name, blocks[name]);
    });
  }

  lookup(name) {
    if (name in this.env.globals && !(name in this.ctx)) {
      return this.env.globals[name];
    }
    return this.ctx[name];
  }

  setVariable(name, val) {
    this.ctx[name] = val;
  }

  getVariables() {
    return this.ctx;
  }

  addBlock(name, block) {
    this.blocks[name] = this.blocks[name] || [];
    this.blocks[name].push(block);
    return this;
  }

  getBlock(name) {
    if (!this.blocks[name]) {
      const err = new Error('unknown block "' + name + '"');
      err.code = 'UNDEFINED_BLOCK';
      err.subject = name;
      throw err;
    }
    return this.blocks[name][0];
  }

  getSuper(env, name, block, frame, runtime) {
    const idx = (this.blocks[name] || []).indexOf(block);
    const blk = this.blocks[name][idx + 1];

    if (idx === -1 || !blk) {
      const err = new Error('no super block available for "' + name + '"');
      err.code = 'NO_SUPER_BLOCK';
      err.subject = name;
      throw err;
    }

    return blk(env, this, frame, runtime);
  }

  addExport(name) {
    this.exported.push(name);
  }

  getExported() {
    const exported = {};
    this.exported.forEach((name) => {
      exported[name] = this.ctx[name];
    });
    return exported;
  }
}
