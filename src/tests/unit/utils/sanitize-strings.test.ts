import { expect, describe, it } from '@jest/globals';
import { sanitizeStr } from '../../../utils/santize-string';

describe('sanitizeStr', () => {
  it('should remove tab characters from the string', () => {
    const input = 'Hello\tWorld';
    const result = sanitizeStr(input);
    expect(result).toBe('Hello World');
  });

  it('should limit the string to 49 characters', () => {
    const input = 'This is a very long string that exceeds forty-nine characters in length.';
    const result = sanitizeStr(input);
    expect(result).toBe('This is a very long string that exceeds forty-nin');
  });

  it('should handle strings with both tabs and long length', () => {
    const input = 'This\tis\ta\tvery\tlong\tstring\tthat\texceeds\tforty-nine\tcharacters.';
    const result = sanitizeStr(input);
    expect(result).toBe('This is a very long string that exceeds forty-nin');
  });

  it('should return an empty string if the input is empty', () => {
    const input = '';
    const result = sanitizeStr(input);
    expect(result).toBe('');
  });

  it('should handle strings shorter than 49 characters without tabs', () => {
    const input = 'Short string';
    const result = sanitizeStr(input);
    expect(result).toBe('Short string');
  });
});
