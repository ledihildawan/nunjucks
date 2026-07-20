import { createSourceMap } from '../helpers/source-map.js';
import { DEFAULT_UNDEFINED_MODE } from '../runtime/undefined.js';

export const createCompilerContext = (templateName, undefinedMode, source) => ({
  templateName,
  codebuf: [],
  lastId: 0,
  buffer: null,
  bufferStack: [],
  _scopeClosers: '',
  inBlock: false,
  undefinedMode: undefinedMode || DEFAULT_UNDEFINED_MODE,
  compiledLine: 0,
  sourceMap: createSourceMap(templateName),
});
