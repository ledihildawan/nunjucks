export const abs = Math.abs;

export const round = (val: number, precision: number = 0, method?: 'ceil' | 'floor' | 'round'): number => {
  const factor = Math.pow(10, precision);
  let rounder: (x: number) => number;
  if (method === 'ceil') rounder = Math.ceil;
  else if (method === 'floor') rounder = Math.floor;
  else rounder = Math.round;
  return rounder(val * factor) / factor;
};
