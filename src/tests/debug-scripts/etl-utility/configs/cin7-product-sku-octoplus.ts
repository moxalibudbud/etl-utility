import { LineOutputOptions, LineSourceBaseOptions } from '../../../../index';

export const line: LineSourceBaseOptions = {
  columns: [],
  mandatoryFields: ['sku', 'internal_barcode', 'Category'],
  identifierMappings: {
    barcode: 'internal_barcode',
    sku: 'sku',
    id: 'ID',
  },
  outputMappings: {
    TYPE_MOUVEMENT: 'M',
    CODE_ARTICLE: 'sku',
    MAIN_EAN: 'internal_barcode',
    CODE_PRODUCT: 'ID',
    SHORT_LABEL: 'Name',
    LONG_LABEL: '',
    CODE_SEASON: '',
    CODE_SUPPLIER: '',
    CODE_FAMILY: 'Category',
    CODE_NGP: '',
    CODE_COLOR: '',
    CODE_SIZE: '',
    PRIMARY_TYPE_TAG: '',
    SECONDARY_TYPE_TAG: '',
    SELLING_PRICE: '',
    BUYING_PRICE: '',
    URL_PICTURE: '',
    TRACEABILITY_MODE: '',
    SUPPLIER_REF: '',
    END_PRODUCT: '',
    QUANTITY: '',
    UNIT: '',
    FIDELITY_PRICE: '',
    USERFIELD_1: '',
    USERFIELD_2: '',
    USERFIELD_3: '',
    USERFIELD_4: '',
    USERFIELD_5: '',
    CODE_BRAND: '',
    PRICE_COMPARISON_UNIT: '',
    PRICE_COMPARISON_DIVIDER: '',
    RANK: '',
  },
  separator: ';',
  withHeader: false,
};

export const output: LineOutputOptions = {
  filename: {
    template: 'I_SKU_[timestamp].csv',
  },
  header:
    'TYPE_MOUVEMENT;CODE_ARTICLE;MAIN_EAN;CODE_PRODUCT;SHORT_LABEL;LONG_LABEL;CODE_SEASON;CODE_SUPPLIER;CODE_FAMILY;CODE_NGP;CODE_COLOR;CODE_SIZE;PRIMARY_TYPE_TAG;SECONDARY_TYPE_TAG;SELLING_PRICE;BUYING_PRICE;URL_PICTURE;TRACEABILITY_MODE;SUPPLIER_REF;END_PRODUCT;QUANTITY;UNIT;FIDELITY_PRICE;USERFIELD_1;USERFIELD_2;USERFIELD_3;USERFIELD_4;USERFIELD_5;CODE_BRAND;PRICE_COMPARISON_UNIT;PRICE_COMPARISON_DIVIDER;RANK',
  separator: ';',
  uniqueKey: 'SKU',
};
