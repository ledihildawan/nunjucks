// WHY: generator-rendering drain helpers (Option B). Root renders as an async generator that yields string fragments and returns the post-render context. capture/component bodies reuse the same generator model. These helpers drain generators back into values for blocking consumers. Array+join is used instead of += concatenation to avoid O(n²) string copies on large templates with many chunks.
const collectString = async (stream: AsyncIterable<string>): Promise<string> => {
  const chunks: string[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return chunks.join('');
};

// WHY: like collectString but also captures the generator's return value — the post-render context the root generator returns (so import/getExported can read setVariable/addExport writes). Recursive accumulator is used instead of for-await because for-await does not expose the generator's return value.
const collectStream = async (
  stream: AsyncGenerator<string, unknown>,
): Promise<{ output: string; context: unknown }> => {
  const drain = async (
    acc: string[],
  ): Promise<{ acc: string[]; value: unknown }> => {
    const step = await stream.next();
    if (step.done) {
      return { acc, value: step.value };
    }
    return drain([...acc, step.value]);
  };

  const { acc, value } = await drain([]);
  return { output: acc.join(''), context: value };
};

export { collectString, collectStream };
