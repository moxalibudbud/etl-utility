"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const map_1 = require("../../../utils/map");
(0, globals_1.describe)('mapFields', () => {
    const input = {
        CCID: 'S123',
        INV_NO: 'INV-456',
        PRICE: 100,
    };
    (0, globals_1.it)('maps fields using direct keys', () => {
        const config = {
            storeId: 'CCID',
            countId: 'INV_NO',
        };
        const result = (0, map_1.mapFields)(input, config);
        (0, globals_1.expect)(result).toEqual({
            storeId: 'S123',
            countId: 'INV-456',
        });
    });
    (0, globals_1.it)('maps fields using a mix of keys and transform functions', () => {
        const config = {
            storeId: 'CCID',
            countId: (data) => `${data.INV_NO}-modified`,
            priceWithTax: (data) => data.PRICE * 1.05,
        };
        const result = (0, map_1.mapFields)(input, config);
        (0, globals_1.expect)(result).toEqual({
            storeId: 'S123',
            countId: 'INV-456-modified',
            priceWithTax: 105,
        });
    });
    (0, globals_1.it)('returns empty object when config is empty', () => {
        const result = (0, map_1.mapFields)(input, {});
        (0, globals_1.expect)(result).toEqual({});
    });
    (0, globals_1.it)('handles missing input keys gracefully (returns undefined)', () => {
        const config = {
            missingField: 'DOES_NOT_EXIST',
        };
        const result = (0, map_1.mapFields)(input, config);
        (0, globals_1.expect)(result).toEqual({ missingField: undefined });
    });
});
(0, globals_1.describe)('mapWithDefault', () => {
    const input = {
        CCID: 'S123',
        INV_NO: 'INV-456',
        PRICE: 100,
    };
    (0, globals_1.it)('maps fields using direct keys', () => {
        const config = {
            storeId: 'CCID',
            countId: 'INV_NO',
        };
        const result = (0, map_1.mapWithDefault)(input, config);
        (0, globals_1.expect)(result).toEqual({
            storeId: 'S123',
            countId: 'INV-456',
        });
    });
    (0, globals_1.it)('maps fields using a mix of keys and transform functions', () => {
        const config = {
            storeId: 'CCID',
            countId: (data) => `${data.INV_NO}-modified`,
            priceWithTax: (data) => data.PRICE * 1.05,
        };
        const result = (0, map_1.mapWithDefault)(input, config);
        (0, globals_1.expect)(result).toEqual({
            storeId: 'S123',
            countId: 'INV-456-modified',
            priceWithTax: 105,
        });
    });
    (0, globals_1.it)('returns empty object when config is empty', () => {
        const result = (0, map_1.mapWithDefault)(input, {});
        (0, globals_1.expect)(result).toEqual({});
    });
    (0, globals_1.it)('maps config value if doesnt exist from input', () => {
        const config = {
            storeId: 'CCID',
            countId: 'INV_NO',
            isSerialized: '0',
            costPrice: '100',
            retailPrice: '0',
        };
        const result = (0, map_1.mapWithDefault)(input, config);
        (0, globals_1.expect)(result).toEqual({
            storeId: 'S123',
            countId: 'INV-456',
            isSerialized: '0',
            costPrice: '100',
            retailPrice: '0',
        });
    });
});
