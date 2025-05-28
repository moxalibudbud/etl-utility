import {
  LineOutputOptions,
  LineSourceBaseOptions,
  SourceLine,
} from 'etl-utility';

export const line: LineSourceBaseOptions = {
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
    active: 'true',
    sku: 'PART_NUMBER',
    barcode: 'BARCODE',
    model_code: '',
    part_number: 'PART_NUMBER',
    internal_ref: '',
    supplier_ref: '',
    supplier_name: '',
    name: 'DESCRIPTION',
    description: 'DESCRIPTION2',
    rsp: '0.00',
    cost: '0.00',
    brand: 'BRAND',
    depart_ref: '',
    depart_name: '',
    class_ref: '',
    class_name: '',
    color: 'COLOR',
    style: 'STYLE',
    size: '',
    gender: '',
    season: '',
    is_serialized: false,
    is_batched: false,
    uom: 'g',
    category_ref: '',
    extra1: '',
    extra2: '',
    extra3: '',
    extra4: '',
    extra5: '',
  },
  separator: ',',
  withHeader: true,
};

function generateHeader() {
  return Object.keys(line.outputMappings).join(';') + '\n';
}

export const output: LineOutputOptions = {
  filename: 'stocksmart_item_master.csv',
  // filename: function (args: SourceLine) {
  //   return args.output?.brandName
  //     ? `${args.output?.brandName}_ItemMaster_${Date.now()}.txt`
  //     : `ItemMaster_${Date.now()}.csv`;
  // },
  header: generateHeader(),
  // footer: 'sample footer',
  // header: (args: SourceLine) => generatorOptions.columns.join(generatorOptions.separator) + '\n',
  // footer: 'sample footer',
  separator: ';',
  // template: 'false;{BARCODE};{PART_NUMBER};{DESCRIPTION};g',
};
