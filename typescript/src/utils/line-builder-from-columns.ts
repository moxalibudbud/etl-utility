type Options = { separator?: string; columns: string[] };

export function buildLineFromColumns(line: Record<string, string>, options: Options) {
  const separator = options.separator || '|';
  return options.columns.map((key: string) => line[key]).join(separator);
}
