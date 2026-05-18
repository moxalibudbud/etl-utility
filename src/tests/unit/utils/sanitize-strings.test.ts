import { expect, describe, it } from '@jest/globals';
import { sanitizeString } from '../../../utils/santize-string';

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
      const input = 'path\\qfile';  // value: path\qfile
      expect(sanitizeString(input)).toBe('path\\\\qfile');  // value: path\\qfile
    });

    it('leaves a backslash followed by a valid JSON escape char unchanged', () => {
      const input = '\\nline\\ttab\\"quote';  // value: \nline\ttab\"quote — all valid JSON escapes
      expect(sanitizeString(input)).toBe('\\nline\\ttab\\"quote');
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
