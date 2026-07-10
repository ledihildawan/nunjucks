import { createSourceMap } from '../helpers/source-map.js';

export const createCompilerContext = (templateName, throwOnUndefined, source) => ({
  templateName,
  codebuf: [],
  lastId: 0,
  buffer: null,
  bufferStack: [],
  _scopeClosers: '',
  inBlock: false,
  throwOnUndefined,
  compiledLine: 0,
  sourceMap: createSourceMap(templateName),
});
