import { keys, isFunction, isNonNullish } from 'remeda';

export const createContainer = () => {
  const factories = new Map();
  const instances = new Map();
  const singletons = new Set();

  const register = (name, factory, options = {}) => {
    if (!isFunction(factory)) {
      throw new Error(`Container: factory for '${name}' must be a function, got ${typeof factory}`);
    }
    factories.set(name, factory);
    if (options.singleton) {
      singletons.add(name);
    }
    return container;
  };

  const registerInstance = (name, instance) => {
    instances.set(name, instance);
    return container;
  };

  const resolve = (name, ...args) => {
    if (instances.has(name)) {
      return instances.get(name);
    }

    const factory = factories.get(name);
    if (!factory) {
      throw new Error(`Container: '${name}' is not registered. Did you forget to register it?`);
    }

    const deps = factory.length > 0 && args.length === 0
      ? factories.keys()
          .filter(k => k !== name)
          .map(k => resolve(k))
      : args;

    if (singletons.has(name)) {
      if (!instances.has(name)) {
        const instance = factory(...deps);
        instances.set(name, instance);
        return instance;
      }
      return instances.get(name);
    }

    return factory(...deps);
  };

  const has = (name) => factories.has(name) || instances.has(name);

  const remove = (name) => {
    factories.delete(name);
    instances.delete(name);
    singletons.delete(name);
    return container;
  };

  const clear = () => {
    factories.clear();
    instances.clear();
    singletons.clear();
    return container;
  };

  const getRegistered = () => [...factories.keys()];

  const container = {
    register,
    registerInstance,
    resolve,
    has,
    remove,
    clear,
    getRegistered,

    environment: (...args) => resolve('environment', ...args),
    template: (...args) => resolve('template', ...args),
    context: (...args) => resolve('context', ...args),
    frame: (...args) => resolve('frame', ...args),
    compiler: (...args) => resolve('compiler', ...args),
    parser: (...args) => resolve('parser', ...args),
    tokenizer: (...args) => resolve('tokenizer', ...args),
    errorFormatter: (...args) => resolve('errorFormatter', ...args),

    loader: {
      fileSystem: (...args) => resolve('loader.fileSystem', ...args),
      nodeResolve: (...args) => resolve('loader.nodeResolve', ...args),
    },

    sandbox: {
      environment: (...args) => resolve('sandbox.environment', ...args),
      context: (...args) => resolve('sandbox.context', ...args),
    },

    createScopedContainer: () => createScopedContainer({ register, resolve, has, remove, clear, getRegistered }),
  };

  return container;
};

export const createScopedContainer = (parent) => {
  const localInstances = new Map();

  const resolve = (name, ...args) => {
    if (localInstances.has(name)) {
      return localInstances.get(name);
    }

    const instance = parent.resolve(name, ...args);
    localInstances.set(name, instance);
    return instance;
  };

  return {
    ...parent,
    resolve,
    createScope: () => createScopedContainer(parent)
  };
};

export const createContainerWithDefaults = (defaults = {}) => {
  const container = createContainer();

  keys(defaults).forEach((name) => {
    const def = defaults[name];
    if (isFunction(def)) {
      container.register(name, def);
    } else if (isNonNullish(def)) {
      container.registerInstance(name, def);
    }
  });

  return container;
};

export const createLazyProxy = (factory) => {
  let instance = null;
  return new Proxy({}, {
    get(target, prop) {
      if (!instance) {
        instance = factory();
      }
      return instance[prop];
    },
    set(target, prop, value) {
      if (!instance) {
        instance = factory();
      }
      instance[prop] = value;
      return true;
    },
    has(target, prop) {
      if (!instance) {
        instance = factory();
      }
      return prop in instance;
    }
  });
};
