import { LineOutputOptions, LineSourceBaseOptions, SourceLine } from 'src/line-data';

export const line: LineSourceBaseOptions = {
  columns: [
    'itemId',
    'family',
    'supplier',
    'supplierReference',
    'quantity',
    'rspTaxExclusive',
    'coefficient',
    'rspTaxInclusive',
    'vatCode',
    'metalTitle',
    'metalWeight',
    'size',
    'fbco',
    'pieceNo',
    'pieceDate',
    'tracking',
    'style',
    'status',
    'engravingNo',
    'oldReference',
    'itemLabel',
    'showcase',
    'quantityEntrustedBy',
    'quantityEntrustedTo',
  ],
  mandatoryFields: ['store', 'quantity', 'itemId'],
  identifierMappings: { barcode: 'itemId', sku: 'itemId' },
  outputMappings: {
    store_ref: 'store',
    product_sku: 'itemId',
    quantity: 'quantity',
    cost: 'rspTaxExclusive',
    rsp: 'rspTaxInclusive',
  },
  separator: '\t',
  withHeader: true,
  // toJSON: function (line: string[]) {
  //   const columnMap = this.columns.reduce((map, column, index) => {
  //     map[column] = line[index];
  //     return map;
  //   }, {} as Record<string, string>) as Record<string, string>;

  //   columnMap['store'] = columnMap['itemId'].split('.')[0];

  //   return columnMap;
  // },
  customValues: [
    {
      field: 'itemId',
      expression: 'itemId.length',
    },
  ],
};

export const output: LineOutputOptions = {
  filename: 'locate_item_soh.csv',
  // filename: function (args: SourceLine) {
  //   return `locate_soh_${Date.now()}.csv`;
  // },
  // header: Object.keys(line.outputMappings).join(';') + '\n',
  header: `store_ref;product_sku;quantity;cost;rsp\n`,
  // footer: 'sample footer',
  // header: (args: SourceLine) => generatorOptions.columns.join(generatorOptions.separator) + '\n',
  // footer: 'sample footer',
  separator: ';',
  // template: 'false;{BARCODE};{PART_NUMBER};{DESCRIPTION};g',
  template: '{store};{itemId};{quantity};{rspTaxExclusive};{rspTaxInclusive}',
};
