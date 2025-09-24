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

  // Cache file for unique references
  indexFile?: string;

  // Unique references holder.
  // Scenario 1: This is used with combination of uniqueKey. If the outout file must produce unique row based on column value.
  //             Example. if uniqueKey exists in rowReferences then don't repush line

  // Scenario 2: This is used with combination of indexFile. If the outout file must produce new row based on column value.
  //             We load the references from indexFile and load to this variable.
  //             Example. if uniqueKey exists in rowReferences then repush line
  rowReferences?: Set<string | number>;

  fileGenerator?: 'default-generator' | 'push-if-exist' | 'file-index-generator';
};

export type LineOutputOptions = LineOutputBase;
