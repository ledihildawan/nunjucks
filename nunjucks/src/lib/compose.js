export function compose(...fns) {
  return (x) => fns.reduceRight((acc, fn) => fn(acc), x);
}

export function pipe(x, ...fns) {
  return fns.reduce((acc, fn) => fn(acc), x);
}
