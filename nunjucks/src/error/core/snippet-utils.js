export const getSnippet = (sourceLines, centerLine, context = 3) => {
  if (!sourceLines || !Array.isArray(sourceLines)) {
    return null;
  }

  const start = Math.max(0, centerLine - context - 1);
  const end = Math.min(sourceLines.length, centerLine + context);

  const lines = sourceLines.slice(start, end).map((line, i) => {
    const lineNum = start + i + 1;
    const isError = lineNum === centerLine;
    const prefix = isError ? '>>> ' : '    ';
    const content = line || ' ';
    return `${prefix}${lineNum}: ${content}`;
  });

  while (lines.length > 1 && lines[lines.length - 1].trim() === `${lines[lines.length - 1].split(':')[0].trim()}:`) {
    lines.pop();
  }

  return lines.join('\n');
};

export const extractLineFromSnippet = (snippet) => {
  if (!snippet) return null;

  const lines = snippet.split('\n');
  for (const line of lines) {
    if (line.trim().startsWith('>>>')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const lineNum = parseInt(line.substring(0, colonIdx).replace('>>>', '').trim(), 10);
        if (!isNaN(lineNum)) return lineNum;
      }
    }
  }

  return null;
};

export const splitSnippetLines = (snippet) => {
  return snippet ? snippet.split('\n').map(l => l.trim()) : [];
};
