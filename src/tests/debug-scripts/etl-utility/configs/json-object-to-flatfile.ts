import { LineOutputOptions, LineSourceBaseOptions } from '../../../../index';

export const line: LineSourceBaseOptions = {
  columns: [],
  mandatoryFields: [],
  identifierMappings: {},
  outputMappings: {},
  separator: 'na',
  withHeader: false,
};

export const output: LineOutputOptions = {
  filename: {
    template: 'json-object-to-flatfile.csv',
  },
  header: 'sku;name;internal_barcode',
  template: '{sku};[return args.metadata.name];{internal_barcode}',
  separator: 'na',
};
