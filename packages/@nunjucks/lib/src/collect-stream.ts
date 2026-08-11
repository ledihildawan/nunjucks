// WHY: async generator drain helpers. collectString collects all yielded strings into one combined string. collectStream also captures the generator's return value. Recursive accumulator is used instead of for-await because for-await does not expose the generator's return value.
const collectString = async (stream: AsyncIterable<string>): Promise<string> => {
  const chunks: string[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return chunks.join('');
};
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
