import { SourceLine } from './source-line';

type LineOutputBase = {
  filename: string | ((line: SourceLine) => string) | { template: string };
  separator: string;
  header?: string | ((line: SourceLine) => string);
  footer?: string | (() => string);

  // If not provide (default) - Values will be automatically assign according to LineSourceBaseOptions.outputMappings and LineSourceBaseOptions.separator
  // If string = The value must follow template syntax. Example = false;{BARCODE};{PART_NUMBER};{DESCRIPTION};g
  // If function = A custom function define from the settings
  template?: string | ((line: SourceLine) => string);

  // If provided. The ETL will skip a row if the given key already exist in the output.
  // This will only work if source data is object
  uniqueKey?: string;
};

export type LineOutputOptions = LineOutputBase;
