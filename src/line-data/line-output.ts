type LineOutputBase = {
  filename: string | ((args: any) => string);
  separator: string;
  header?: string | ((args: any) => string);
  footer?: string | ((args: any) => string);
  template?: string;
};

export type LineOutputOptions = LineOutputBase;
