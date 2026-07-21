const OBJ = Symbol('obj');

export function createObj(props: Record<string, unknown> = {}): Record<string, unknown> {
  const obj: Record<string, unknown> & { [OBJ]: boolean } = {
    [OBJ]: true,
    ...props,
  };
  obj.init = props.init || function () {};
  return obj;
}

export const isObj = (obj: unknown): boolean => (obj as Record<symbol, unknown> | null)?.[OBJ] === true;
