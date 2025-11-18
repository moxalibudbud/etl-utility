import { expect, describe, it } from '@jest/globals';
import { skuSerial } from '../../../utils/sku-serial';

describe('SKU Serial Functions', () => {
  describe('encodeMetadata', () => {
    it('should encode SKU and serial number into bracketed format', () => {
      const result = skuSerial('ABC123', 'SN-001').encode();
      expect(result).toBe('[ABC123][SN-001]');
    });

    it('should handle empty strings', () => {
      const result = skuSerial('', '').encode();
      expect(result).toBe('[][]');
    });

    it('should handle special characters', () => {
      const result = skuSerial('SKU-@#$', 'SER!@#').encode();
      expect(result).toBe('[SKU-@#$][SER!@#]');
    });

    it('should handle numeric values as strings', () => {
      const result = skuSerial('12345', '67890').encode();
      expect(result).toBe('[12345][67890]');
    });

    it('should handle values with spaces', () => {
      const result = skuSerial('ABC 123', 'SN 001').encode();
      expect(result).toBe('[ABC 123][SN 001]');
    });
  });

  describe('decodeMetadata', () => {
    it('should decode bracketed format back into SKU and serial', () => {
      const result = skuSerial('[ABC123][SN-001]').decode();
      expect(result).toEqual({
        sku: 'ABC123',
        serial: 'SN-001',
        isSerialized: true,
      });
    });

    it('should handle empty brackets', () => {
      const result = skuSerial('[][]').decode();
      expect(result).toEqual({
        sku: '[][]',
        serial: '[][]',
        isSerialized: false,
      });
    });

    it('should return original input if no brackets present', () => {
      const input = 'PLAINSKU';
      const result = skuSerial(input).decode();
      expect(result).toEqual({
        sku: input,
        serial: input,
        isSerialized: false,
      });
    });

    it('should handle single bracketed value', () => {
      const result = skuSerial('[ABC123]').decode();
      expect(result).toEqual({
        sku: 'ABC123',
        serial: '[ABC123]',
        isSerialized: false,
      });
    });

    it('should handle multiple bracketed values (more than 2)', () => {
      const result = skuSerial('[ABC][123][XYZ]').decode();
      expect(result).toEqual({
        sku: 'ABC',
        serial: '123',
        isSerialized: true,
      });
    });

    it('should handle values with special characters in brackets', () => {
      const result = skuSerial('[SKU-@#$][SER!@#]').decode();
      expect(result).toEqual({
        sku: 'SKU-@#$',
        serial: 'SER!@#',
        isSerialized: true,
      });
    });

    it('should handle values with spaces inside brackets', () => {
      const result = skuSerial('[ABC 123][SN 001]').decode();
      expect(result).toEqual({
        sku: 'ABC 123',
        serial: 'SN 001',
        isSerialized: true,
      });
    });
  });

  describe('skuSerial function', () => {
    it('should return an object with encode and decode methods', () => {
      const result = skuSerial('ABC123', 'SN-001');
      expect(result).toHaveProperty('encode');
      expect(result).toHaveProperty('decode');
      expect(typeof result.encode).toBe('function');
      expect(typeof result.decode).toBe('function');
    });

    it('should encode and decode correctly in sequence', () => {
      const sku = 'TEST-SKU';
      const serial = 'SERIAL-123';

      const encoded = skuSerial(sku, serial).encode();
      const decoded = skuSerial(encoded).decode();

      expect(decoded.sku).toBe(sku);
      expect(decoded.serial).toBe(serial);
    });

    it('should handle single argument for decode', () => {
      const result = skuSerial('[ABC123][SN-001]').decode();
      expect(result.sku).toBe('ABC123');
      expect(result.serial).toBe('SN-001');
    });

    it('should handle two arguments for encode', () => {
      const result = skuSerial('ABC123', 'SN-001').encode();
      expect(result).toBe('[ABC123][SN-001]');
    });
  });

  describe('edge cases', () => {
    it('should handle very long strings', () => {
      const longSku = 'A'.repeat(1000);
      const longSerial = 'B'.repeat(1000);
      const encoded = skuSerial(longSku, longSerial).encode();
      const decoded = skuSerial(encoded).decode();

      expect(decoded.sku).toBe(longSku);
      expect(decoded.serial).toBe(longSerial);
    });

    it('should handle brackets in the middle of unformatted string', () => {
      const input = 'ABC[123]XYZ';
      const result = skuSerial(input).decode();
      expect(result.sku).toBe('123');
      expect(result.serial).toBe(input);
    });

    it('should handle consecutive brackets', () => {
      const result = skuSerial('[][]').decode();
      expect(result.sku).toBe('[][]');
      expect(result.serial).toBe('[][]');
    });

    it('should handle only opening brackets', () => {
      const input = '[[[';
      const result = skuSerial(input).decode();
      expect(result.sku).toBe(input);
      expect(result.serial).toBe(input);
    });

    it('should handle only closing brackets', () => {
      const input = ']]]';
      const result = skuSerial(input).decode();
      expect(result.sku).toBe(input);
      expect(result.serial).toBe(input);
    });
  });
});
