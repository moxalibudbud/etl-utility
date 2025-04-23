import { describe, expect, it } from '@jest/globals';
import { buildLineFromTemplate } from '../../utils/line-builder-from-template';

describe('buildLineFromTemplate', () => {
  it('should replace placeholders in the template with corresponding values from the line object', () => {
    const line = { name: 'John', age: '30', city: 'New York' };

    const config1 = { template: 'Name: {name}, Age: {age}, City: {city}' };
    const result1 = buildLineFromTemplate(line, config1);
    expect(result1).toBe('Name: John, Age: 30, City: New York');

    const config2 = { template: '{name}|{age}|{city}' };
    const result2 = buildLineFromTemplate(line, config2);
    expect(result2).toBe('John|30|New York');
  });

  it('should replace placeholders with an empty string if the key is missing in the line object', () => {
    const line = { name: 'John', age: '30' };
    const config = { template: 'Name: {name}, Age: {age}, City: {city}' };

    const result = buildLineFromTemplate(line, config);

    expect(result).toBe('Name: John, Age: 30, City: ');
  });

  it('should return the template unchanged if there are no placeholders', () => {
    const line = { name: 'John', age: '30', city: 'New York' };
    const config = { template: 'No placeholders here' };

    const result = buildLineFromTemplate(line, config);

    expect(result).toBe('No placeholders here');
  });

  it('should handle an empty line object gracefully', () => {
    const line = {};
    const config = { template: 'Name: {name}, Age: {age}, City: {city}' };

    const result = buildLineFromTemplate(line, config);

    expect(result).toBe('Name: , Age: , City: ');
  });
});
