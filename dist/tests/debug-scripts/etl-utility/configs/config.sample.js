"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.output = exports.line = void 0;
exports.line = {
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
exports.output = {
    filename: 'Item Master.txt',
    separator: '\t',
};
