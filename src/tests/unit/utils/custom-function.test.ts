import { describe, expect, it } from '@jest/globals';
import { customFunction } from '../../../utils/custom-function';

describe('customFunction', () => {
  describe('object argument', () => {
    it('concatenates surname and name with a hyphen', () => {
      const fnBody = 'return `${args.surname}-${args.name}`';
      const result = customFunction(fnBody, { surname: 'Doe', name: 'John' }, null);

      expect(result).toBe('Doe-John');
    });

    it('accesses nested object properties', () => {
      const fnBody = 'return args.user.email';
      const result = customFunction(fnBody, { user: { email: 'a@b.com' } }, null);

      expect(result).toBe('a@b.com');
    });

    it('can call methods on object values', () => {
      const fnBody = 'return args.name.toUpperCase()';
      const result = customFunction(fnBody, { name: 'alice' }, null);

      expect(result).toBe('ALICE');
    });

    it('returns defaultValue when the function body throws', () => {
      const fnBody = 'return args.missing.property';
      const result = customFunction(fnBody, {}, 'fallback');

      expect(result).toBe('fallback');
    });

    it('returns defaultValue when the function body has a syntax error', () => {
      const result = customFunction('invalid )(( syntax', {}, 'default');

      expect(result).toBe('default');
    });
  });
});
