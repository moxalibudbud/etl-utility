type LineOutputBase = {
  filename: string | ((args: any) => string) | { template: string };
  separator: string;
  header?: string | ((args: any) => string);
  footer?: string | ((args: any) => string);
  template?: string | ((args: any) => string);
};

export type LineOutputOptions = LineOutputBase;
