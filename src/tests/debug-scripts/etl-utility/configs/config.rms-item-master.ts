import { SourceLine } from '../../../../line-data';

export const line = {
  columns: [
    'barcode',
    'itemId',
    'vpn',
    'itemDescription',
    'color',
    'size',
    'dept',
    'deptName',
    'class',
    'className',
    'subclass',
    'subclassName',
    'itemCost',
  ],
  mandatoryFields: ['barcode', 'itemId', 'vpn', 'itemCost'],
  identifierMappings: { barcode: 'barcode', sku: 'ItemId' },
  outputMappings: {
    brandName: 'brandCode',
    departmentCode: 'dept',
    departmentName: 'deptName',
    className: 'className',
    color: 'color',
    size: 'size',
    styleNo: 'class',
    itemCode: 'barcode',
    barcode: 'barcode',
    sku: 'itemId',
    isSerialized: '0',
    supplierRef: 'subclassName',
    erpArticleRef: 'subclass',
    otherInternalRef: 'barcode',
    itemDescription: 'itemDescription',
    costPrice: 'itemCost',
    retailPrice: '0',
  },
  separator: '|',
  withHeader: false,
};

export const output = {
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
