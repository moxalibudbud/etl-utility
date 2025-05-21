import { describe, expect, it } from '@jest/globals';
import { SourceLine } from '../../../index';

describe('SourceLine test 1', () => {
  const line = 'RE1-J426-BAT	128770527	143	3	2222';
  const options = {
    columns: ['store', 'sku', 'quantity', 'sohQuantity', 'countId'],
    mandatoryFields: ['store', 'sku', 'quantity', 'countId'],
    identifierMappings: { store: 'store', sku: 'sku', quantity: 'quantity' },
    outputMappings: { store: 'store', sku: 'sku', quantity: 'quantity', ccid: 'store', default: 'xxx' },
    separator: '\t',
    withHeader: true,
  };

  const sourceLine = new SourceLine(line, { ...options, currentLineNumber: 2 });

  it('should correctly parse the line into properties', () => {
    expect(sourceLine.line).toEqual(['RE1-J426-BAT', '128770527', '143', '3', '2222']);
    expect(sourceLine.columns).toEqual(['store', 'sku', 'quantity', 'sohQuantity', 'countId']);
    expect(sourceLine.jsonLine).toEqual({
      store: 'RE1-J426-BAT',
      sku: '128770527',
      quantity: '143',
      sohQuantity: '3',
      countId: '2222',
    });
  });

  it('should correctly identify "tab" separator', () => {
    expect(sourceLine.separator).toBe('\t');
  });

  it('should fail because seperator is "tab"', () => {
    expect(sourceLine.separator).not.toBe(';');
  });

  it('should validate the line correctly', () => {
    sourceLine.validate();
    expect(sourceLine.isValid).toBe(true);
    expect(sourceLine.error).toBe('');
  });

  it('should correctly identify if the line is a header', () => {
    expect(sourceLine.isHeader).toBe(false);
  });

  it('should correctly map identifiers', () => {
    expect(sourceLine.identifiers).toEqual({
      store: 'RE1-J426-BAT',
      sku: '128770527',
      quantity: '143',
    });
  });

  it('should correctly map output fields', () => {
    expect(sourceLine.output).toEqual({
      store: 'RE1-J426-BAT',
      ccid: 'RE1-J426-BAT',
      sku: '128770527',
      quantity: '143',
      default: 'xxx',
    });
  });
});
