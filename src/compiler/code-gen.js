import { pipe, filter, isDefined, reduce } from 'remeda';
import { parse } from '../parser/index.js';
import { transform } from '../transformers/index.js';
import { createTemplateError } from '../error/index.js';
import { createSourceMap } from '../helpers/source-map.js';
import { build } from './builder.js';
import { optimize } from './optimizer.js';

export const DEFAULT_COMPILER_OPTS = Object.freeze({
  async: 'auto',
  sourceMap: false,
  autoescape: true,
  trimBlocks: false,
  lstripBlocks: false,
  undefined: 'chainable',
});

export function compile(source, extensions = [], exts = [], name = 'template', opts = {}) {
  const options = { ...DEFAULT_COMPILER_OPTS, ...opts };
  
  const processedSrc = pipe(
    exts,
    exts => exts.map(ext => ext.preprocess),
    comps => filter(comps, isDefined),
    processors => reduce(processors, (s, processor) => processor(s), source)
  );

  const ast = parse(processedSrc, options, name);
  
  const transformedAst = transform(ast, extensions, name);

  const sourceMap = options.sourceMap 
    ? createSourceMap(name) 
    : null;

  const code = build(transformedAst, options, name, sourceMap);

  const optimizedCode = options.async === false 
    ? code 
    : optimize(code, options);

  if (sourceMap) {
    return {
      code: optimizedCode,
      sourceMap: sourceMap.toJSON(),
    };
  }

  return optimizedCode;
}

export function compileSync(source, extensions = [], exts = [], name = 'template', opts = {}) {
  return compile(source, extensions, exts, name, { ...opts, async: false });
}
