type BuildLineOptions = {
  template: string;
};

export function buildLineFromTemplate(line: Record<string, string>, config: BuildLineOptions): string {
  let output = config.template.replace(/\{(\w+)\}/g, (_, key) => {
    return line[key] != null ? line[key] : '';
  });

  return output;
}
