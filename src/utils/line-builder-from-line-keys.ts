type Options = { separator?: string };

export function buildLineFromLineKeys(line: Record<string, string>, options: Options = {}) {
  const separator = options.separator || '|';
  const columns = Object.keys(line);
  return columns.map((key: string) => line[key]).join(separator);
}
