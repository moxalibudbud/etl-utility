import { LineOutputOptions, LineSourceBaseOptions } from '../../../../index';

export const line: LineSourceBaseOptions = {
  columns: ['TYPE_DOCUMENT', 'LOC_DEP', 'LOC_DEST', 'N_COLIS', 'CODE_ARTICLE', 'QTE_STOCK', 'REF_EXTERNE'],
  mandatoryFields: ['CODE_ARTICLE'],
  identifierMappings: {
    sku: 'CODE_ARTICLE',
  },
  outputMappings: {
    TYPE_DOCUMENT: 'print_query_warehouse',
    LOC_DEP: 'LocationId',
    LOC_DEST: 'LocationId',
    N_COLIS: 'Reference1',
    CODE_ARTICLE: 'SKU',
    QTE_STOCK: 'Expected',
    REF_EXTERNE: 'Reference1',
  },
  separator: ',',
  withHeader: true,
};

export const output: LineOutputOptions = {
  filename: {
    template: 'INT05_[timestamp].csv',
  },
  header: 'TYPE_DOCUMENT;LOC_DEP;LOC_DEST;N_COLIS;CODE_ARTICLE;QTE_STOCK;REF_EXTERNE',
  separator: ';',
};
