export declare function skuSerial(...args: string[]): {
    decode: () => {
        sku: string;
        serial: string;
        isSerialized: boolean;
    };
    encode: () => string;
};
