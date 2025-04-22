type BuildLineOptions = {
  template: string;
  separator?: string;
  appendNewline?: boolean;
};

export function buildLineFromTemplate(line: Record<string, string>, config: BuildLineOptions): string {
  let output = config.template.replace(/\{(\w+)\}/g, (_, key) => {
    return line[key] != null ? line[key] : '';
  });

  if (config.appendNewline) {
    output += '\n';
  }

  return output;
}
