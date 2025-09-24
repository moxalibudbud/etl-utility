"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.output = exports.line = void 0;
exports.line = {
    columns: [
        'TYPE_MOUVEMENT',
        'CODE_ARTICLE',
        'MAIN_EAN',
        'CODE_PRODUCT',
        'SHORT_LABEL',
        'LONG_LABEL',
        'CODE_SEASON',
        'CODE_SUPPLIER',
        'CODE_FAMILY',
        'CODE_NGP',
        'CODE_COLOR',
        'CODE_SIZE',
        'PRIMARY_TYPE_TAG',
        'SECONDARY_TYPE_TAG',
        'SELLING_PRICE',
        'BUYING_PRICE',
        'URL_PICTURE',
        'TRACEABILITY_MODE',
        'SUPPLIER_REF',
        'END_PRODUCT',
        'QUANTITY',
        'UNIT',
        'FIDELITY_PRICE',
        'USERFIELD_1',
        'USERFIELD_2',
        'USERFIELD_3',
        'USERFIELD_4',
        'USERFIELD_5',
        'CODE_BRAND',
        'PRICE_COMPARISON_UNIT',
        'PRICE_COMPARISON_DIVIDER',
        'RANK',
    ],
    mandatoryFields: ['CODE_ARTICLE'],
    identifierMappings: {
        sku: 'CODE_ARTICLE',
    },
    outputMappings: {
        SKU: 'CODE_ARTICLE',
    },
    separator: ';',
    withHeader: true,
};
exports.output = {
    filename: 'sku-index.dat',
    separator: ';',
};
