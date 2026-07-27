export function awaitValue(val: unknown): unknown {
  if (val && typeof (val as { then?: unknown }).then === 'function') {
    return (val as Promise<unknown>).then((v) => v);
  }
  return val;
}
