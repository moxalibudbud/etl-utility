import { describe, expect, it } from '@jest/globals';
import { replaceWithFunction } from '../../../utils/replace-with-function';

describe('replaceWithFunction', () => {
  describe('no placeholder match', () => {
    it('returns empty string unchanged', () => {
      expect(replaceWithFunction('')).toBe('');
    });

    it('returns string with no placeholders unchanged', () => {
      expect(replaceWithFunction('simple_file_name.txt')).toBe('simple_file_name.txt');
    });

    it('keeps malformed (unclosed) bracket expressions as-is', () => {
      const template = 'file_[unclosed_bracket.txt';
      expect(replaceWithFunction(template)).toBe('file_[unclosed_bracket.txt');
    });
  });

  describe('supported function: timestamp', () => {
    it('replaces [timestamp] with a numeric timestamp', () => {
      const template = 'file_[timestamp].txt';
      const result = replaceWithFunction(template);

      expect(result).toMatch(/^file_\d+\.txt$/);
      expect(result).not.toContain('[timestamp]');
    });

    it('produces a value close to Date.now()', () => {
      const before = Date.now();
      const result = replaceWithFunction('[timestamp]');
      const after = Date.now();

      const value = Number(result);
      expect(value).toBeGreaterThanOrEqual(before);
      expect(value).toBeLessThanOrEqual(after);
    });
  });

  describe('supported function: dateTime', () => {
    it('replaces [dateTime] with the default format YYYY-MM-DDTHH:mm:ssZ', () => {
      const template = 'export_[dateTime].csv';
      const result = replaceWithFunction(template);

      expect(result).toMatch(/^export_\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.+\.csv$/);
      expect(result).not.toContain('[dateTime]');
    });

    it('accepts a custom format argument', () => {
      const template = 'backup_[dateTime, YYYY-MM-DD].sql';
      const result = replaceWithFunction(template);

      expect(result).toMatch(/^backup_\d{4}-\d{2}-\d{2}\.sql$/);
    });

    it('accepts both custom format and timezone arguments', () => {
      const template = 'log_[dateTime, YYYY-MM-DD HH:mm:ss, UTC].log';
      const result = replaceWithFunction(template);

      expect(result).toMatch(/^log_\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.log$/);
    });

    it('supports milliseconds via SSS token', () => {
      const template = '[dateTime, YYYY-MM-DD_HH:mm:ss.SSS]';
      const result = replaceWithFunction(template);

      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}_\d{2}:\d{2}:\d{2}\.\d{3}$/);
    });

    it('trims whitespace around comma-separated arguments', () => {
      const template = '[dateTime , YYYY-MM-DD , UTC]';
      const result = replaceWithFunction(template);

      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('customFunction fallback (unknown function name)', () => {
    it('evaluates a simple property access from metadata', () => {
      const template = 'user_[return args.name].txt';
      const result = replaceWithFunction(template, { name: 'alice' });

      expect(result).toBe('user_alice.txt');
    });

    it('evaluates a numeric metadata field and stringifies it', () => {
      const template = 'count_[return args.count]';
      const result = replaceWithFunction(template, { count: 42 });

      expect(result).toBe('count_42');
    });

    it('concatenates surname and name with a hyphen using template literal', () => {
      const template = '[return `${args.surname}-${args.name}`]';
      const result = replaceWithFunction(template, { surname: 'Doe', name: 'John' });

      expect(result).toBe('Doe-John');
    });

    it('evaluates a boolean metadata field', () => {
      const template = 'flag_[return args.active]';
      const result = replaceWithFunction(template, { active: true });

      expect(result).toBe('flag_true');
    });

    it('evaluates a nested metadata property', () => {
      const template = '[return args.user.email]';
      const result = replaceWithFunction(template, { user: { email: 'a@b.com' } });

      expect(result).toBe('a@b.com');
    });

    it('supports method invocation on metadata values', () => {
      const template = '[return args.name.toUpperCase()]';
      const result = replaceWithFunction(template, { name: 'bob' });

      expect(result).toBe('BOB');
    });

    it('returns the literal string "undefined" when metadata field is missing', () => {
      const template = 'x_[return args.missing]';
      const result = replaceWithFunction(template, { name: 'alice' });

      expect(result).toBe('x_undefined');
    });

    it('keeps the original placeholder when no metadata is passed and identifier is undefined', () => {
      const template = 'file_[unknownFunction].txt';
      const result = replaceWithFunction(template);

      expect(result).toBe('file_[unknownFunction].txt');
    });

    it('keeps the original placeholder when the function body throws', () => {
      const template = 'file_[return args.user.email].txt';
      const result = replaceWithFunction(template, {});

      expect(result).toBe('file_[return args.user.email].txt');
    });

    it('defaults metadata to an empty object when omitted', () => {
      const template = '[return Object.keys(args).length]';
      const result = replaceWithFunction(template);

      expect(result).toBe('0');
    });
  });

  describe('multiple placeholders', () => {
    it('handles multiple supported-function placeholders in one template', () => {
      const template = '[timestamp]_[dateTime, YYYY-MM-DD]_data';
      const result = replaceWithFunction(template);

      expect(result).toMatch(/^\d+_\d{4}-\d{2}-\d{2}_data$/);
    });

    it('mixes supported functions, customFunction hits, and unknown placeholders', () => {
      const template = '[timestamp]_[return args.name]_[unknownFunc]_[dateTime, YYYY]';
      const result = replaceWithFunction(template, { name: 'alice' });

      expect(result).toMatch(/^\d+_alice_\[unknownFunc\]_\d{4}$/);
    });
  });
});
