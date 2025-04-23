import { describe, expect, it } from '@jest/globals';
import { lineDataToJSON } from '../../utils';

describe('lineDataToJSON', () => {
  it('should map fields to corresponding values', () => {
    const fields = ['name', 'age', 'city'];
    const values = ['John', '30', 'New York'];

    const result = lineDataToJSON(fields, values);

    expect(result).toEqual({
      name: 'John',
      age: '30',
      city: 'New York',
    });
  });

  it('should handle empty fields and values', () => {
    const fields: string[] = [];
    const values: any[] = [];

    const result = lineDataToJSON(fields, values);

    expect(result).toEqual({});
  });

  it('should handle mismatched fields and values', () => {
    const fields = ['name', 'age'];
    const values = ['John'];

    const result = lineDataToJSON(fields, values);

    expect(result).toEqual({
      name: 'John',
      age: undefined,
    });
  });
});
