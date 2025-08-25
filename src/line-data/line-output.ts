type LineOutputBase = {
  filename: string | ((args: any) => string) | { template: string };
  separator: string;
  header?: string | ((args: any) => string);
  footer?: string | ((args: any) => string);
  template?: string | ((args: any) => string);

  // If provided. The ETL will skip a row if the given key already exist in the output.
  // This will only work if source data is object
  uniqueKey?: string;
};

export type LineOutputOptions = LineOutputBase;
