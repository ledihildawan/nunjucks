export function createFrame(parent, isolateWrites) {
  const state = {
    variables: Object.create(null),
    parent,
    topLevel: false,
    isolateWrites
  };

  return {
    get variables() { return state.variables; },
    set variables(val) { state.variables = val; },
    get parent() { return state.parent; },
    set parent(val) { state.parent = val; },
    get topLevel() { return state.topLevel; },
    set topLevel(val) { state.topLevel = val; },
    get isolateWrites() { return state.isolateWrites; },

    set(name, val, resolveUp) {
      const parts = name.split('.');
      let obj = state.variables;
      let frame = this;

      if (resolveUp) {
        if ((frame = this.resolve(parts[0], true))) {
          frame.set(name, val);
          return;
        }
      }

      for (let i = 0; i < parts.length - 1; i++) {
        const id = parts[i];
        if (!obj[id]) {
          obj[id] = {};
        }
        obj = obj[id];
      }

      obj[parts.at(-1)] = val;
    },

    get(name) {
      const val = state.variables[name];
      if (val !== undefined) {
        return val;
      }
      return null;
    },

    lookup(name) {
      const p = state.parent;
      const val = state.variables[name];
      if (val !== undefined) {
        return val;
      }
      return p && p.lookup(name);
    },

    resolve(name, forWrite) {
      const p = (forWrite && state.isolateWrites) ? undefined : state.parent;
      const val = state.variables[name];
      if (val !== undefined) {
        return this;
      }
      return p && p.resolve(name);
    },

    push(writeIsolation) {
      return createFrame(this, writeIsolation);
    },

    pop() {
      return state.parent;
    }
  };
}
