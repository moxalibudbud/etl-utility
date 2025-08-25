import { LineOutputOptions, LineSourceBaseOptions, SourceLine } from '../../../../index';

export const line: LineSourceBaseOptions = {
  columns: ['Reference1', 'LocationId', 'SKU', 'Expected', 'Date', 'From_Loc_Type'],
  mandatoryFields: ['Reference1', 'LocationId', 'SKU', 'Expected'],
  identifierMappings: { reference: 'Reference1', location: 'LocationId' },
  outputMappings: {
    SUBTYPE: 'store_replenishment',
    EXTERNAL_DOC_REFERENCE: 'Reference1',
    EXTERNAL_ORDER_REFERENCE: 'Reference1',
    USER_REASON: '',
    TRACKING_NUMBER: '',
    LOCATION_FROM: 'LocationId',
    LOCATION_TO: 'LocationId',
    DELIVERY_AREA: '',
    IS_OVERSUPPLY: '0',
    PARCEL_QUANTITY: '',
    DELIVERY_DATE: 'Date',
    CODE_ARTICLE: 'SKU',
    EXPECTED_QUANTITY: 'Expected',
    PARCEL: '',
    PALLET: '',
    STATUS: 'to_check',
  },
  separator: ',',
  withHeader: true,
};

export const output: LineOutputOptions = {
  // filename: 'Item Master.txt',
  // filename: function ({ jsonLine }: SourceLine) {
  //   const { LocationId } = jsonLine;
  //   return `I_DII_${LocationId}_${Date.now()}.csv`;
  // },
  filename: {
    template: 'I_DII_{LocationId}_[timestamp].csv',
  },
  header: 'TYPE_ATTRIBUT;CODE_ATTRIBUT;LIBELLE_ATTRIBUT;TYPE_ATTRIBUT_PARENT;CODE_ATTRIBUT_PARENT\n',
  // footer: 'sample footer',
  // header: (args: SourceLine) => generatorOptions.columns.join(generatorOptions.separator) + '\n',
  // footer: 'sample footer',
  separator: ';',
  // template: 'false;{BARCODE};{PART_NUMBER};{DESCRIPTION};g',
};
