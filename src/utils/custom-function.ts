export function customFunction(fnBody: string, args: Object, defaultValue: any): any {
  try {
    const fn = new Function('args', fnBody);
    const result = fn(args);
    return result;
  } catch {
    return defaultValue;
  }
}
