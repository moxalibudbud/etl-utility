type LineOutputBase = {
  filename: string | ((args: any) => string);
  header?: string | ((args: any) => string);
  footer?: string | ((args: any) => string);
  separator: string;
  columns: string[];
};

type TemplateOnly = {
  template: string;
  rowMap?: never;
};

type RowMapOnly = {
  template?: never;
  rowMap: Record<string, string>;
};

export type LineOutputOptions = LineOutputBase & (TemplateOnly | RowMapOnly);
