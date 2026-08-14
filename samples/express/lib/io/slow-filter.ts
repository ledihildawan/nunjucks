// WHY: shell-side time-based filter — simulates DB latency for streaming demo. Lives in lib/io/ because
// setTimeout is a side-effecting primitive (§2 Functional Core / Imperative Shell boundary).
const slow = async (value: unknown): Promise<string> => {
  await new Promise((resolve) => { setTimeout(resolve, 350); });
  return String(value);
};

export { slow };
