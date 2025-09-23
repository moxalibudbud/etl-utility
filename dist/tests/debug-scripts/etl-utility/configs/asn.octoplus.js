"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.output = exports.line = void 0;
exports.line = {
    columns: ['Reference1', 'LocationId', 'SKU', 'Expected', 'Date', 'From_Loc_Type'],
    mandatoryFields: ['Reference1', 'LocationId', 'SKU', 'Expected'],
    identifierMappings: {
        reference: 'Reference1',
        location: 'LocationId',
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
exports.output = {
    filename: {
        template: 'INT05_[timestamp].csv',
    },
    header: 'TYPE_DOCUMENT;LOC_DEP;LOC_DEST;N_COLIS;CODE_ARTICLE;QTE_STOCK;REF_EXTERNE',
    separator: ';',
};
