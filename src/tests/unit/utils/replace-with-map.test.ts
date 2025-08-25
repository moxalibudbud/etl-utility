import { describe, expect, it } from '@jest/globals';
import { replaceWithMap } from '../../../utils/replace-with-map';

describe('replaceWithMap', () => {
  it('should replace placeholders in the template with corresponding values from the line object', () => {
    const line = { name: 'John', age: '30', city: 'New York' };

    const template1 = 'Name: {name}, Age: {age}, City: {city}';
    const result1 = replaceWithMap(template1, line);
    expect(result1).toBe('Name: John, Age: 30, City: New York');

    const template2 = '{name}|{age}|{city}';
    const result2 = replaceWithMap(template2, line);
    expect(result2).toBe('John|30|New York');
  });

  it('should replace placeholders with an empty string if the key is missing in the line object', () => {
    const line = { name: 'John', age: '30' };
    const template = 'Name: {name}, Age: {age}, City: {city}';
    const result = replaceWithMap(template, line);

    expect(result).toBe('Name: John, Age: 30, City: ');
  });

  it('should return the template unchanged if there are no placeholders', () => {
    const line = { name: 'John', age: '30', city: 'New York' };
    const template = 'No placeholders here';

    const result = replaceWithMap(template, line);

    expect(result).toBe('No placeholders here');
  });

  it('should handle an empty line object gracefully', () => {
    const line = {};
    const template = 'Name: {name}, Age: {age}, City: {city}';

    const result = replaceWithMap(template, line);

    expect(result).toBe('Name: , Age: , City: ');
  });
});
