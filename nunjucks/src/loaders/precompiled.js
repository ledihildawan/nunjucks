import { createLoader } from './base.js';
import { Maybe } from '../helpers/monad.js';

const getPrecompiledSource = (precompiled) => (name) => {
  const maybe = Maybe.fromNullable(precompiled[name]);
  if (Maybe.isJust(maybe)) {
    return { src: { type: 'code', obj: maybe.value }, path: name };
  }
  return null;
};

export function createPrecompiledLoader(compiledTemplates = {}) {
  const loader = createLoader();
  loader.precompiled = compiledTemplates;

  loader.getSource = (name) =>
    getPrecompiledSource(loader.precompiled)(name);

  return loader;
}
