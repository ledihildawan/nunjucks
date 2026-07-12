export function getCallerLocation() {
  const err = new Error();
  const stack = err.stack;

  if (!stack) return null;

  const lines = stack.split('\n');

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    if (!line) continue;

    const normalizedLine = line.replace(/\\/g, '/');

    const skipPatterns = [
      '/nunjucks/src/',
      '/node_modules/',
      'node:',
      'bun:',
      'internal/',
      'Promise',
      'createEnvironment',
      'createTemplate',
      'createSandboxedContext',
      'render',
    ];

    const shouldSkip = skipPatterns.some(pattern => 
      normalizedLine.toLowerCase().includes(pattern.toLowerCase())
    );

    if (shouldSkip) continue;

    const match = line.match(/\(([^)]+):(\d+):(\d+)\)$/);
    if (match) {
      const fullPath = match[1];
      const shortFileName = fullPath.split(/[\\/]/).pop();
      const lineNum = Number(match[2]);
      const colNum = Number(match[3]);

      if (/\.(?:mjs|cjs|ts|jsx|tsx|js|sjs)$/i.test(fullPath)) {
        return {
          file: shortFileName,
          fullPath,
          line: lineNum,
          column: colNum
        };
      }
    }

    const simpleMatch = line.match(/\(([^)]+):(\d+)\)$/);
    if (simpleMatch && /\.(?:mjs|cjs|ts|jsx|tsx|js|sjs)$/i.test(simpleMatch[1])) {
      const fullPath = simpleMatch[1];
      const shortFileName = fullPath.split(/[\\/]/).pop();
      const lineNum = Number(simpleMatch[2]);

      return {
        file: shortFileName,
        fullPath,
        line: lineNum,
        column: 1
      };
    }
  }

  return null;
}

export function formatCallerLocation(caller) {
  if (!caller) return null;
  return `${caller.file}:${caller.line}:${caller.column}`;
}
