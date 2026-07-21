// SOURCE MAP - Track compiled-to-original line mappings
// Import directly: import { createSourceMap } from '@nunjucks/compiler/source-map'

export interface SourceMapMapping {
  compiledLine: number;
  originalLine: number;
  originalCol: number;
}

export interface SourceMap {
  readonly templateName: string | null;
  mappings: SourceMapMapping[];
  addMapping: (compiledLine: number, originalLine: number, originalCol?: number) => void;
  getOriginalPosition: (compiledLine: number) => { line: number; col: number; name: string | null };
}

const createLocation = (line: number, col: number, name: string | null): { line: number; col: number; name: string | null } =>
  ({ line, col, name });

export const createSourceMap = (templateName: string | null): SourceMap => {
  const state: { templateName: string | null; mappings: SourceMapMapping[] } = {
    templateName,
    mappings: [],
  };

  return {
    get templateName(): string | null {
      return state.templateName;
    },
    get mappings(): SourceMapMapping[] {
      return state.mappings;
    },
    set mappings(val: SourceMapMapping[]) {
      state.mappings = val;
    },

    addMapping(compiledLine: number, originalLine: number, originalCol = 0): void {
      state.mappings.push({ compiledLine, originalLine, originalCol });
    },

    getOriginalPosition(compiledLine: number): { line: number; col: number; name: string | null } {
      if (compiledLine <= 0) {
        return createLocation(0, 0, state.templateName);
      }

      for (let i = state.mappings.length - 1; i >= 0; i--) {
        const mapping = state.mappings[i];
        if (compiledLine >= mapping.compiledLine) {
          const offset = compiledLine - mapping.compiledLine;
          return createLocation(mapping.originalLine + offset, mapping.originalCol, state.templateName);
        }
      }

      return createLocation(compiledLine - 1, 0, state.templateName);
    },
  };
};
