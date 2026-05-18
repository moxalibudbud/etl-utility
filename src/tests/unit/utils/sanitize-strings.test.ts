import { expect, describe, it } from '@jest/globals';
import { sanitizeString, sanitizeJsonValue, removeWhiteSpaces } from '../../../utils/santize-string';

describe('sanitizeString', () => {
  describe('control characters → space', () => {
    it('replaces tab with space', () => {
      expect(sanitizeString('Hello\tWorld')).toBe('Hello World');
    });

    it('replaces newline with space', () => {
      expect(sanitizeString('line1\nline2')).toBe('line1 line2');
    });

    it('replaces carriage return with space', () => {
      expect(sanitizeString('line1\rline2')).toBe('line1 line2');
    });

    it('replaces null byte with space', () => {
      expect(sanitizeString('null\x00byte')).toBe('null byte');
    });

    it('replaces DEL (0x7F) with space', () => {
      expect(sanitizeString('del\x7Fchar')).toBe('del char');
    });

    it('replaces all other control chars with space', () => {
      expect(sanitizeString('\x01\x02\x1E\x1F')).toBe('    ');
    });

    it('replaces multiple different control chars in one string', () => {
      expect(sanitizeString('a\tb\nc\rd')).toBe('a b c d');
    });
  });

  describe('JSON backslash safety', () => {
    it('escapes a bare backslash not followed by a valid JSON escape char', () => {
      const input = 'path\\qfile'; // value: path\qfile
      expect(sanitizeString(input)).toBe('path\\\\qfile'); // value: path\\qfile
    });

    it('leaves a backslash followed by a valid JSON escape char unchanged', () => {
      const input = '\\nline\\ttab\\"quote'; // value: \nline\ttab\"quote — all valid JSON escapes
      expect(sanitizeString(input)).toBe('\\nline\\ttab\\"quote');
    });

    it('leaves a double backslash before a non-JSON-escape char unchanged', () => {
      const input = 'M\\\\LUNGHE'; // value: M\\LUNGHE — \\ is a valid JSON escape for backslash
      expect(sanitizeString(input)).toBe('M\\\\LUNGHE'); // second-pass re-processing must not split the \\ pair
    });
  });

  describe('safe for JSON.parse', () => {
    it('produces output that does not throw when embedded in a JSON string', () => {
      const dirty = 'value with\nnewline and\ttab and\\backslash';
      const clean = sanitizeString(dirty);
      expect(() => JSON.parse(`{"key": "${clean}"}`)).not.toThrow();
    });

    it('produces output safe for JSON.parse with control chars', () => {
      const dirty = 'col1\x00col2\x1Fcol3';
      const clean = sanitizeString(dirty);
      expect(() => JSON.parse(`{"key": "${clean}"}`)).not.toThrow();
    });

    it('sanitizes a full JSON string with special characters so JSON.parse succeeds', () => {
      // Raw JSON string where values contain control characters that would cause JSON.parse to throw
      const dirty = '{"name": "some name with\ttab and\nnewline", "note": "data\x00with\x1Fnull bytes"}';
      const clean = sanitizeString(dirty);

      expect(() => JSON.parse(clean)).not.toThrow();

      const parsed = JSON.parse(clean);
      expect(parsed.name).toBe('some name with tab and newline');
      expect(parsed.note).toBe('data with null bytes');
    });
  });

  describe('safe for CSV content', () => {
    it('removes newlines that would create extra CSV rows', () => {
      expect(sanitizeString('cell1\ncell2')).not.toContain('\n');
    });

    it('removes carriage returns that would break CSV rows', () => {
      expect(sanitizeString('cell1\r\ncell2')).not.toMatch(/[\r\n]/);
    });

    it('removes tabs that would break TSV columns', () => {
      expect(sanitizeString('col1\tcol2')).not.toContain('\t');
    });
  });

  describe('clean strings pass through unchanged', () => {
    it('returns an empty string as-is', () => {
      expect(sanitizeString('')).toBe('');
    });

    it('returns a plain string unchanged', () => {
      expect(sanitizeString('Hello World')).toBe('Hello World');
    });

    it('returns a string with numbers and symbols unchanged', () => {
      expect(sanitizeString('abc123 !@#$%^&*()')).toBe('abc123 !@#$%^&*()');
    });
  });
});

describe('removeWhiteSpaces', () => {
  it('removes all spaces from a string', () => {
    expect(removeWhiteSpaces('hello world')).toBe('helloworld');
  });

  it('removes tabs and newlines', () => {
    expect(removeWhiteSpaces('hello\t\nworld')).toBe('helloworld');
  });

  it('returns an empty string unchanged', () => {
    expect(removeWhiteSpaces('')).toBe('');
  });

  it('returns a string with no whitespace unchanged', () => {
    expect(removeWhiteSpaces('nospaces')).toBe('nospaces');
  });
});

describe('sanitizeJsonValue', () => {
  describe('double quote escaping', () => {
    it('escapes a double quote', () => {
      expect(sanitizeJsonValue('"hello"')).toBe('\\"hello\\"');
    });

    it('escapes multiple double quotes', () => {
      expect(sanitizeJsonValue('say "hi" there')).toBe('say \\"hi\\" there');
    });

    it('returns empty string unchanged', () => {
      expect(sanitizeJsonValue('')).toBe('');
    });

    it('returns a clean string unchanged', () => {
      expect(sanitizeJsonValue('Hello World')).toBe('Hello World');
    });
  });

  describe('inherits sanitizeString behaviour', () => {
    it('replaces control characters with spaces', () => {
      expect(sanitizeJsonValue('col1\tcol2\ncol3')).toBe('col1 col2 col3');
    });

    it('removes bare backslashes', () => {
      expect(sanitizeJsonValue('path\\qfile')).toBe('pathqfile');
    });

    it('leaves a double backslash before a non-JSON-escape char unchanged', () => {
      const input = 'M\\\\LUNGHE'; // value: M\\LUNGHE — \\ is a valid JSON escape for backslash
      expect(sanitizeJsonValue(input)).toBe('M\\\\LUNGHE'); // \\ pair must not be split; bare \L stripping should not touch it
    });
  });

  describe('combined control chars and double quotes', () => {
    it('replaces control chars and escapes quotes together', () => {
      expect(sanitizeJsonValue('"col1\ncol2"')).toBe('\\"col1 col2\\"');
    });
  });

  describe('safe for JSON.parse', () => {
    it('produces output that does not throw when embedded in a JSON string', () => {
      const dirty = '"value" with\nnewline and\ttab';
      const clean = sanitizeJsonValue(dirty);
      expect(() => JSON.parse(`{"key": "${clean}"}`)).not.toThrow();
    });

    it('produces output safe for JSON.parse with control chars and quotes', () => {
      const dirty = '"col1\x00col2"\x1F"col3"';
      const clean = sanitizeJsonValue(dirty);
      expect(() => JSON.parse(`{"key": "${clean}"}`)).not.toThrow();
    });

    it('produces output safe for JSON.parse with control chars and quotes', () => {
      const dirty =
        '{"sku": "032825445973", "productName": "WV3ABH807FS-0BO:VLT.0BO:41:CAMICIA M\\\LUNGHE SCUDETTO COLLEGE", "barcode": "8050943098055", "rsp": 3430.00, "cost": 1083.20, "categoryRef": "6755"}';
      const clean = sanitizeJsonValue(dirty);
      expect(() => JSON.parse(`{"key": "${clean}"}`)).not.toThrow();
    });
  });
});
