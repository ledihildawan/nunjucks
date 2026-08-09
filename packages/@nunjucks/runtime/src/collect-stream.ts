// WHY: generator-rendering drain helpers (Option B). Root renders as an async generator that yields string fragments and returns the post-render context. capture/component bodies reuse the same generator model. These helpers drain generators back into values for blocking consumers. The loops are permitted per the stream-processing exemption (isolated pure abstractions draining async streams) and are stack-safe for large templates, unlike recursive drains which would overflow on thousands of chunks.
const collectString = async (stream: AsyncIterable<string>): Promise<string> => {
  let output = '';
  for await (const chunk of stream) {
    output += chunk;
  }
  return output;
};

// WHY: like collectString but also captures the generator's return value — the post-render context the root generator returns (so import/getExported can read setVariable/addExport writes). A manual .next() loop is used instead of for-await because for-await does not expose the generator's return value.
const collectStream = async (stream: AsyncGenerator<string, unknown>): Promise<{ output: string; context: unknown }> => {
  let output = '';
  let step = await stream.next();
  while (!step.done) {
    output += step.value;
    step = await stream.next();
  }
  return { output, context: step.value };
};

export { collectString, collectStream };
