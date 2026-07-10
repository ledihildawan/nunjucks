import Loader from './base.js';
import { Maybe } from '../helpers/monad.js';

const getPrecompiledSource = (precompiled) => (name) => {
  const maybe = Maybe.fromNullable(precompiled[name]);
  if (Maybe.isJust(maybe)) {
    return { src: { type: 'code', obj: maybe.value }, path: name };
  }
  return null;
};

export const createPrecompiledLoader = (compiledTemplates = {}) => {
  const loader = new Loader();
  loader.precompiled = compiledTemplates;

  loader.getSource = (name) =>
    getPrecompiledSource(loader.precompiled)(name);

  return loader;
};

export class PrecompiledLoader extends Loader {
  constructor(compiledTemplates = {}) {
    super();
    this.precompiled = compiledTemplates;
  }

  getSource(name) {
    return getPrecompiledSource(this.precompiled)(name);
  }
}
