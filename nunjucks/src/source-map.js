export class SourceMap {
  constructor(templateName, source) {
    this.templateName = templateName;
    this.source = source;
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

  static fromJSON(data) {
    const sm = new SourceMap(data.templateName || 'unknown');
    sm.mappings = data.mappings || [];
    return sm;
  }

  toJSON() {
    return {
      templateName: this.templateName,
      mappings: this.mappings
    };
  }
}

export function enableSourceMap() {
}

export function disableSourceMap() {
}
