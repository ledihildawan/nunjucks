export function createFrame(parent, isolateWrites) {
  const rootState = parent?._rootState ?? { revision: 0 };
  const state = {
    variables: Object.create(null),
    parent,
    topLevel: false,
    isolateWrites,
    rootState,
    resolveCache: new Map(),
    lookupCache: new Map()
  };

  return {
    get variables() { return state.variables; },
    set variables(val) { state.variables = val; state.rootState.revision++; state.resolveCache.clear(); state.lookupCache.clear(); },
    get _rootState() { return state.rootState; },
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
      state.rootState.revision++;
      state.resolveCache.clear();
      state.lookupCache.clear();
    },

    get(name) {
      const val = state.variables[name];
      if (val !== undefined) {
        return val;
      }
      return null;
    },

    lookup(name) {
      const cached = state.lookupCache.get(name);
      if (cached !== undefined) {
        return cached;
      }

      const p = state.parent;
      const val = state.variables[name];
      const result = val !== undefined ? val : (p && p.lookup(name));
      state.lookupCache.set(name, result);
      return result;
    },

    resolve(name, forWrite) {
      const cacheKey = `${name}\u0000${forWrite ? 1 : 0}`;
      const cached = state.resolveCache.get(cacheKey);
      if (cached && cached.revision === state.rootState.revision) {
        return cached.frame;
      }

      const val = state.variables[name];
      if (val !== undefined) {
        if (forWrite && state.isolateWrites) {
          return undefined;
        }
        state.resolveCache.set(cacheKey, { revision: state.rootState.revision, frame: this });
        return this;
      }
      if (forWrite && state.isolateWrites) {
        return undefined;
      }
      const p = state.parent;
      const frame = p && p.resolve(name);
      state.resolveCache.set(cacheKey, { revision: state.rootState.revision, frame });
      return frame;
    },

    push(writeIsolation) {
      return createFrame(this, writeIsolation);
    },

    pop() {
      return state.parent;
    }
  };
}
