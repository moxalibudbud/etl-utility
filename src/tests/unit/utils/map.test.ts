import { test, expect, describe, it } from '@jest/globals';
import { mapFields, mapWithDefault } from '../../../utils/map';

describe('mapFields', () => {
  const input = {
    CCID: 'S123',
    INV_NO: 'INV-456',
    PRICE: 100,
  };

  it('maps fields using direct keys', () => {
    const config = {
      storeId: 'CCID',
      countId: 'INV_NO',
    };

    const result = mapFields(input, config);

    expect(result).toEqual({
      storeId: 'S123',
      countId: 'INV-456',
    });
  });

  it('maps fields using a mix of keys and transform functions', () => {
    const config = {
      storeId: 'CCID',
      countId: (data: Record<string, any>) => `${data.INV_NO}-modified`,
      priceWithTax: (data: Record<string, any>) => data.PRICE * 1.05,
    };

    const result = mapFields(input, config);

    expect(result).toEqual({
      storeId: 'S123',
      countId: 'INV-456-modified',
      priceWithTax: 105,
    });
  });

  it('returns empty object when config is empty', () => {
    const result = mapFields(input, {});
    expect(result).toEqual({});
  });

  it('handles missing input keys gracefully (returns undefined)', () => {
    const config = {
      missingField: 'DOES_NOT_EXIST',
    };

    const result = mapFields(input, config);
    expect(result).toEqual({ missingField: undefined });
  });
});

describe('mapWithDefault', () => {
  const input = {
    CCID: 'S123',
    INV_NO: 'INV-456',
    PRICE: 100,
  };

  it('maps fields using direct keys', () => {
    const config = {
      storeId: 'CCID',
      countId: 'INV_NO',
    };

    const result = mapWithDefault(input, config);

    expect(result).toEqual({
      storeId: 'S123',
      countId: 'INV-456',
    });
  });

  it('maps fields using a mix of keys and transform functions', () => {
    const config = {
      storeId: 'CCID',
      countId: '[return input.INV_NO + "-modified"]',
      priceWithTax: '[return input.PRICE * 1.05]',
    };

    const result = mapWithDefault(input, config);

    expect(result).toEqual({
      storeId: 'S123',
      countId: 'INV-456-modified',
      priceWithTax: 105,
    });
  });

  it('returns empty object when config is empty', () => {
    const result = mapWithDefault(input, {});
    expect(result).toEqual({});
  });

  it('maps config value if doesnt exist from input', () => {
    const config = {
      storeId: 'CCID',
      countId: 'INV_NO',
      isSerialized: '0',
      costPrice: '100',
      retailPrice: '0',
    };

    const result = mapWithDefault(input, config);
    expect(result).toEqual({
      storeId: 'S123',
      countId: 'INV-456',
      isSerialized: '0',
      costPrice: '100',
      retailPrice: '0',
    });
  });
});
