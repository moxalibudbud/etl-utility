type LineOutputBase = {
  filename: string | ((line: Record<string, any>) => string);
  header?: string | ((line: Record<string, any>) => string);
  footer?: string | ((args: Record<string, any>) => string);
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
