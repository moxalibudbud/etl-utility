import { describe, expect, it } from '@jest/globals';
import { buildLineFromColumns } from '../../../utils/line-builder-from-columns';

describe('buildLineFromColumns', () => {
  it('should build a line using the specified columns and default separator', () => {
    const line = { name: 'John', age: '30', city: 'New York' };
    const options = { columns: ['name', 'age', 'city'] };

    const result = buildLineFromColumns(line, options);

    expect(result).toBe('John|30|New York');
  });

  it('should build a line using the specified columns and custom separator', () => {
    const line = { name: 'John', age: '30', city: 'New York' };
    const options = { columns: ['name', 'age', 'city'], separator: ',' };

    const result = buildLineFromColumns(line, options);

    expect(result).toBe('John,30,New York');
  });

  it('should handle missing keys in the line object by blank for those columns', () => {
    const line = { name: 'John', age: '30', region: 'NCR' };
    const options = { columns: ['name', 'age', 'city', 'province', 'region'] };

    const result = buildLineFromColumns(line, options);

    expect(result).toBe('John|30|||NCR');
  });

  it('should return an empty line if no columns are specified', () => {
    const line = { name: 'John', age: '30', city: 'New York' };
    const options = { columns: [] };

    const result = buildLineFromColumns(line, options);

    expect(result).toBe('');
  });
});
