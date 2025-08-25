"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.output = exports.line = void 0;
exports.line = {
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
exports.output = {
    filename: {
        template: 'I_DII_{LocationId}_[timestamp].csv',
    },
    header: 'TYPE_ATTRIBUT;CODE_ATTRIBUT;LIBELLE_ATTRIBUT;TYPE_ATTRIBUT_PARENT;CODE_ATTRIBUT_PARENT\n',
    separator: ';',
};
