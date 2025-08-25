export declare const line: {
    columns: string[];
    mandatoryFields: string[];
    identifierMappings: {
        barcode: string;
        sku: string;
    };
    outputMappings: {
        brandName: string;
        departmentCode: string;
        departmentName: string;
        className: string;
        color: string;
        size: string;
        styleNo: string;
        itemCode: string;
        barcode: string;
        sku: string;
        isSerialized: string;
        supplierRef: string;
        erpArticleRef: string;
        otherInternalRef: string;
        itemDescription: string;
        costPrice: string;
        retailPrice: string;
    };
    separator: string;
    withHeader: boolean;
};
export declare const output: {
    filename: string;
    separator: string;
};
