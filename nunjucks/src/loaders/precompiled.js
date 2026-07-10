import Loader from './base.js';
import { Maybe } from '../helpers/monad.js';

const getPrecompiledSource = (precompiled) => (name) =>
  Maybe.just(precompiled[name])
    .map(obj => ({
      src: { type: 'code', obj },
      path: name
    }))
    .getOrElse(() => null);

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
