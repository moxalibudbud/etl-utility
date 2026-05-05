export function customFunction(fnBody: string, input: any, defaultValue: any): any {
  try {
    const fn = new Function('input', fnBody);
    const result = fn(input);
    return result;
  } catch {
    return defaultValue;
  }
}
