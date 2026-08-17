/** Looks a name up in the frame, falling back to the context on `undefined`. */
export const contextOrFrameLookup = (
  context: { lookup: (name: string) => unknown },
  frame: { lookup: (name: string) => unknown },
  name: string
): unknown => {
  const value = frame.lookup(name);
  if (value === undefined) {
    return context.lookup(name);
  }
  return value;
};
