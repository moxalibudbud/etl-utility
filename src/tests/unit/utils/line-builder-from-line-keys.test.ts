import { describe, expect, it } from '@jest/globals';
import { buildLineFromLineKeys } from '../../../utils/line-builder-from-line-keys';

describe('buildLineFromLineKeys', () => {
  it('should build a line by line keys and default separator', () => {
    const line = { name: 'John', age: '30', city: 'New York' };
    const options = {};

    const result = buildLineFromLineKeys(line, options);

    expect(result).toBe('John|30|New York\n');
  });

  it('should build a line by line keys and custom separator', () => {
    const line = { name: 'John', age: '30', city: 'New York' };
    const options = { separator: ',' };

    const result = buildLineFromLineKeys(line, options);

    expect(result).toBe('John,30,New York\n');
  });

  it('should came the numeric field value because that is how Object.keys works', () => {
    const line = { name: 'John', age: '30', 10: 'ten', city: 'New York' };
    const options = { separator: ',' };

    const result = buildLineFromLineKeys(line, options);

    expect(result).toBe('ten,John,30,New York\n');
  });
});
