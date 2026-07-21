export const extractBlocks = (obj) => {
  const blocks = {};
  for (const key of Object.keys(obj)) {
    if (key.startsWith('b_')) {
      blocks[key.slice(2)] = obj[key];
    }
  }
  return blocks;
};

export const createEnv = ({ opts = {}, globals = {}, emitter = null, getTemplate = null } = {}) => {
  const env = {
    opts,
    extensionsList: [],
    globals,
    _renderingTemplates: new Set(),
  };
  if (emitter) {
    env.on = (event, handler) => emitter.on(event, handler);
    env.emit = (event, ...args) => emitter.emit(event, ...args);
    env.removeListener = (event, handler) => emitter.removeListener(event, handler);
  }
  if (getTemplate) {
    env.getTemplate = getTemplate;
  }
  return env;
};
