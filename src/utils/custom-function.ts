const MAX_CACHE = 256;
const fnCache = new Map<string, Function>();

export function customFunction(fnBody: string, args: Object, defaultValue: any): any {
  try {
    let fn = fnCache.get(fnBody);
    if (!fn) {
      fn = new Function('args', fnBody);
      if (fnCache.size >= MAX_CACHE) fnCache.delete(fnCache.keys().next().value!);
      fnCache.set(fnBody, fn);
    }
    return fn(args);
  } catch {
    return defaultValue;
  }
}
