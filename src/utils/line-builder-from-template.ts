type BuildLineOptions = {
  template: string;
  separator?: string;
  appendNewline?: boolean;
};

export function buildLineFromTemplate(
  line: Record<string, any>,
  options: Record<string, any>,
  config: BuildLineOptions
): string {
  const merged = { ...line, ...options };
  let output = config.template.replace(/\{(\w+)\}/g, (_, key) => {
    return merged[key] != null ? merged[key] : '';
  });

  if (config.appendNewline) {
    output += '\n';
  }

  return output;
}
