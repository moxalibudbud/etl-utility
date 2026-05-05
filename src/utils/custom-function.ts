export function customFunction(fnBody: string, input: Object, defaultValue: any): any {
  try {
    const fn = new Function('input', fnBody);
    const result = fn(input);
    return result;
  } catch {
    return defaultValue;
  }
}
