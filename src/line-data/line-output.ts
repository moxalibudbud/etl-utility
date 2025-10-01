import { SourceLine } from './source-line';

export type FileGeneratorValues = 'default-generator' | 'push-if-exist' | 'file-index-generator' | 'json-generator';

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

  fileGenerator?: FileGeneratorValues;

  // If output file is JSON from a flat file. This is the field where the lines will go
  arrayField?: string;
};

export type LineOutputOptions = LineOutputBase;
