export class SourceMap {
  constructor(templateName) {
    this.templateName = templateName;
    this.mappings = [];
  }

  addMapping(compiledLine, originalLine, originalCol = 0) {
    this.mappings.push({
      compiledLine,
      originalLine,
      originalCol
    });
  }

  getOriginalPosition(compiledLine) {
    if (compiledLine <= 0) {
      return { line: 1, col: 0, name: this.templateName };
    }

    for (let i = this.mappings.length - 1; i >= 0; i--) {
      const mapping = this.mappings[i];
      if (compiledLine >= mapping.compiledLine) {
        const offset = compiledLine - mapping.compiledLine;
        return {
          line: mapping.originalLine + offset,
          col: mapping.originalCol,
          name: this.templateName
        };
      }
    }

    return { line: compiledLine, col: 0, name: this.templateName };
  }

  static fromArray(templateName, mappingsArray) {
    const sm = new SourceMap(templateName);
    if (Array.isArray(mappingsArray)) {
      sm.mappings = mappingsArray;
    }
    return sm;
  }
}

export function applySourceMapToError(error, lineno, sourceMapData, templateName) {
  if (!sourceMapData || !Array.isArray(sourceMapData)) {
    return null;
  }

  const sm = SourceMap.fromArray(templateName, sourceMapData);
  const pos = sm.getOriginalPosition(lineno);

  if (error.lineno === undefined) {
    error.lineno = pos.line;
  }
  if (error.colno === undefined) {
    error.colno = pos.col;
  }

  return error;
}
