import { SourceLine } from '@etl/utility/line-data';

export const line = {
  columns: [
    'MESSAGEID',
    'MAIN_BRAND',
    'BRAND',
    'PART_NUMBER',
    'BARCODE',
    'DESCRIPTION',
    'DESCRIPTION_2',
    'STYLE',
    'STYLE_DESCRIPTION',
    'COLOR',
    'COLOR_DESCRIPTION',
    'SIZE_1',
    'SIZE_DESCRIPTION',
    'SIZE_2',
    'SIZE_DESCRIPTION_2',
    'S_PGROUP',
  ],
  mandatoryFields: ['BARCODE', 'PART_NUMBER', 'STYLE'],
  identifierMappings: { barcode: 'BARCODE', sku: 'PART_NUMBER' },
  outputMappings: {
    brandName: 'MAIN_BRAND',
    departmentCode: 'STYLE',
    departmentName: 'BRAND',
    className: 'S_PGROUP',
    color: 'COLOR_DESCRIPTION',
    size: 'SIZE_DESCRIPTION',
    styleNo: 'STYLE_DESCRIPTION',
    itemCode: 'BARCODE',
    barcode: 'BARCODE',
    sku: 'PART_NUMBER',
    isSerialized: '0',
    supplierRef: 'SIZE_DESCRIPTION',
    erpArticleRef: 'SIZE_1',
    otherInternalRef: 'BARCODE',
    itemDescription: 'DESCRIPTION',
    costPrice: '0',
    retailPrice: '0',
  },
  separator: ',',
  withHeader: true,
};

export const outpiut = {
  // filename: 'Item Master.txt',
  filename: (args: SourceLine) =>
    args.output?.brandName
      ? `${args.output?.brandName} - Item Master - ${Date.now()}.txt`
      : `Item Master - ${Date.now()}.txt`,
  // header: 'sample header\n',
  // footer: 'sample footer',
  // header: (args: SourceLine) => generatorOptions.columns.join(generatorOptions.separator) + '\n',
  // footer: 'sample footer',
  separator: '\t',
  // template: 'false;{BARCODE};{PART_NUMBER};{DESCRIPTION};g',
};
