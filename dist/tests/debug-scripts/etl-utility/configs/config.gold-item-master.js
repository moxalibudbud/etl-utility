"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.output = exports.line = void 0;
exports.line = {
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
exports.output = {
    filename: (args) => {
        var _a, _b;
        return ((_a = args.output) === null || _a === void 0 ? void 0 : _a.brandName)
            ? `${(_b = args.output) === null || _b === void 0 ? void 0 : _b.brandName} - Item Master - ${Date.now()}.txt`
            : `Item Master - ${Date.now()}.txt`;
    },
    separator: '\t',
};
