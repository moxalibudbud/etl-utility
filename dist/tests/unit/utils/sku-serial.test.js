"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const sku_serial_1 = require("../../../utils/sku-serial");
(0, globals_1.describe)('SKU Serial Functions', () => {
    (0, globals_1.describe)('encodeMetadata', () => {
        (0, globals_1.it)('should encode SKU and serial number into bracketed format', () => {
            const result = (0, sku_serial_1.skuSerial)('ABC123', 'SN-001').encode();
            (0, globals_1.expect)(result).toBe('[ABC123][SN-001]');
        });
        (0, globals_1.it)('should handle empty strings', () => {
            const result = (0, sku_serial_1.skuSerial)('', '').encode();
            (0, globals_1.expect)(result).toBe('[][]');
        });
        (0, globals_1.it)('should handle special characters', () => {
            const result = (0, sku_serial_1.skuSerial)('SKU-@#$', 'SER!@#').encode();
            (0, globals_1.expect)(result).toBe('[SKU-@#$][SER!@#]');
        });
        (0, globals_1.it)('should handle numeric values as strings', () => {
            const result = (0, sku_serial_1.skuSerial)('12345', '67890').encode();
            (0, globals_1.expect)(result).toBe('[12345][67890]');
        });
        (0, globals_1.it)('should handle values with spaces', () => {
            const result = (0, sku_serial_1.skuSerial)('ABC 123', 'SN 001').encode();
            (0, globals_1.expect)(result).toBe('[ABC 123][SN 001]');
        });
    });
    (0, globals_1.describe)('decodeMetadata', () => {
        (0, globals_1.it)('should decode bracketed format back into SKU and serial', () => {
            const result = (0, sku_serial_1.skuSerial)('[ABC123][SN-001]').decode();
            (0, globals_1.expect)(result).toEqual({
                sku: 'ABC123',
                serial: 'SN-001',
                isSerialized: true,
            });
        });
        (0, globals_1.it)('should handle empty brackets', () => {
            const result = (0, sku_serial_1.skuSerial)('[][]').decode();
            (0, globals_1.expect)(result).toEqual({
                sku: '[][]',
                serial: '[][]',
                isSerialized: false,
            });
        });
        (0, globals_1.it)('should return original input if no brackets present', () => {
            const input = 'PLAINSKU';
            const result = (0, sku_serial_1.skuSerial)(input).decode();
            (0, globals_1.expect)(result).toEqual({
                sku: input,
                serial: input,
                isSerialized: false,
            });
        });
        (0, globals_1.it)('should handle single bracketed value', () => {
            const result = (0, sku_serial_1.skuSerial)('[ABC123]').decode();
            (0, globals_1.expect)(result).toEqual({
                sku: 'ABC123',
                serial: '[ABC123]',
                isSerialized: false,
            });
        });
        (0, globals_1.it)('should handle multiple bracketed values (more than 2)', () => {
            const result = (0, sku_serial_1.skuSerial)('[ABC][123][XYZ]').decode();
            (0, globals_1.expect)(result).toEqual({
                sku: 'ABC',
                serial: '123',
                isSerialized: true,
            });
        });
        (0, globals_1.it)('should handle values with special characters in brackets', () => {
            const result = (0, sku_serial_1.skuSerial)('[SKU-@#$][SER!@#]').decode();
            (0, globals_1.expect)(result).toEqual({
                sku: 'SKU-@#$',
                serial: 'SER!@#',
                isSerialized: true,
            });
        });
        (0, globals_1.it)('should handle values with spaces inside brackets', () => {
            const result = (0, sku_serial_1.skuSerial)('[ABC 123][SN 001]').decode();
            (0, globals_1.expect)(result).toEqual({
                sku: 'ABC 123',
                serial: 'SN 001',
                isSerialized: true,
            });
        });
    });
    (0, globals_1.describe)('skuSerial function', () => {
        (0, globals_1.it)('should return an object with encode and decode methods', () => {
            const result = (0, sku_serial_1.skuSerial)('ABC123', 'SN-001');
            (0, globals_1.expect)(result).toHaveProperty('encode');
            (0, globals_1.expect)(result).toHaveProperty('decode');
            (0, globals_1.expect)(typeof result.encode).toBe('function');
            (0, globals_1.expect)(typeof result.decode).toBe('function');
        });
        (0, globals_1.it)('should encode and decode correctly in sequence', () => {
            const sku = 'TEST-SKU';
            const serial = 'SERIAL-123';
            const encoded = (0, sku_serial_1.skuSerial)(sku, serial).encode();
            const decoded = (0, sku_serial_1.skuSerial)(encoded).decode();
            (0, globals_1.expect)(decoded.sku).toBe(sku);
            (0, globals_1.expect)(decoded.serial).toBe(serial);
        });
        (0, globals_1.it)('should handle single argument for decode', () => {
            const result = (0, sku_serial_1.skuSerial)('[ABC123][SN-001]').decode();
            (0, globals_1.expect)(result.sku).toBe('ABC123');
            (0, globals_1.expect)(result.serial).toBe('SN-001');
        });
        (0, globals_1.it)('should handle two arguments for encode', () => {
            const result = (0, sku_serial_1.skuSerial)('ABC123', 'SN-001').encode();
            (0, globals_1.expect)(result).toBe('[ABC123][SN-001]');
        });
    });
    (0, globals_1.describe)('edge cases', () => {
        (0, globals_1.it)('should handle very long strings', () => {
            const longSku = 'A'.repeat(1000);
            const longSerial = 'B'.repeat(1000);
            const encoded = (0, sku_serial_1.skuSerial)(longSku, longSerial).encode();
            const decoded = (0, sku_serial_1.skuSerial)(encoded).decode();
            (0, globals_1.expect)(decoded.sku).toBe(longSku);
            (0, globals_1.expect)(decoded.serial).toBe(longSerial);
        });
        (0, globals_1.it)('should handle brackets in the middle of unformatted string', () => {
            const input = 'ABC[123]XYZ';
            const result = (0, sku_serial_1.skuSerial)(input).decode();
            (0, globals_1.expect)(result.sku).toBe('123');
            (0, globals_1.expect)(result.serial).toBe(input);
        });
        (0, globals_1.it)('should handle consecutive brackets', () => {
            const result = (0, sku_serial_1.skuSerial)('[][]').decode();
            (0, globals_1.expect)(result.sku).toBe('[][]');
            (0, globals_1.expect)(result.serial).toBe('[][]');
        });
        (0, globals_1.it)('should handle only opening brackets', () => {
            const input = '[[[';
            const result = (0, sku_serial_1.skuSerial)(input).decode();
            (0, globals_1.expect)(result.sku).toBe(input);
            (0, globals_1.expect)(result.serial).toBe(input);
        });
        (0, globals_1.it)('should handle only closing brackets', () => {
            const input = ']]]';
            const result = (0, sku_serial_1.skuSerial)(input).decode();
            (0, globals_1.expect)(result.sku).toBe(input);
            (0, globals_1.expect)(result.serial).toBe(input);
        });
    });
});
