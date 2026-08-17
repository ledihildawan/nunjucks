// WHY: async generator drain helpers. collectString collects all yielded strings into one combined string. collectStream drives the generator with a manual next() loop (for-await does not expose the generator's return value) and pushes into a local array — a push-based accumulator avoids the O(n²) spread copies a recursive [...acc, chunk] drain would make.
const collectString = async (stream: AsyncIterable<string>): Promise<string> => {
  const chunks: string[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return chunks.join('');
};
/**
 * Drains a string generator with a manual `next()` loop (for-await hides the
 * generator's return value), returning both the joined output and the final
 * return value in one envelope.
 */
const collectStream = async (
  stream: AsyncGenerator<string, unknown>
): Promise<{ output: string; returnValue: unknown }> => {
  const chunks: string[] = [];
  while (true) {
    const step = await stream.next();
    if (step.done) {
      return { output: chunks.join(''), returnValue: step.value };
    }
    chunks.push(step.value);
  }
};

export { collectString, collectStream };
