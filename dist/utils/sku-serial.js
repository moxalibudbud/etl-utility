"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.skuSerial = skuSerial;
function encodeMetadata(sku, serial) {
    return `[${sku}][${serial}]`;
}
function decodeMetadata(input) {
    const values = [];
    let start = -1;
    for (let i = 0; i < input.length; i++) {
        if (input[i] === '[') {
            start = i + 1;
        }
        else if (input[i] === ']' && start !== -1) {
            let value = input.slice(start, i);
            values.push(value);
            start = -1;
        }
    }
    return {
        sku: values[0] || input,
        serial: values[1] || input,
        isSerialized: !!values[1],
    };
}
function skuSerial(...args) {
    return {
        decode: () => decodeMetadata(args[0]),
        encode: () => encodeMetadata(args[0], args[1]),
    };
}
