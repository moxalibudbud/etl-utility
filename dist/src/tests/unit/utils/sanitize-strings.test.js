"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const santize_string_1 = require("../../../utils/santize-string");
(0, globals_1.describe)('sanitizeStr', () => {
    (0, globals_1.it)('should remove tab characters from the string', () => {
        const input = 'Hello\tWorld';
        const result = (0, santize_string_1.sanitizeStr)(input);
        (0, globals_1.expect)(result).toBe('Hello World');
    });
    (0, globals_1.it)('should limit the string to 49 characters', () => {
        const input = 'This is a very long string that exceeds forty-nine characters in length.';
        const result = (0, santize_string_1.sanitizeStr)(input);
        (0, globals_1.expect)(result).toBe('This is a very long string that exceeds forty-nin');
    });
    (0, globals_1.it)('should handle strings with both tabs and long length', () => {
        const input = 'This\tis\ta\tvery\tlong\tstring\tthat\texceeds\tforty-nine\tcharacters.';
        const result = (0, santize_string_1.sanitizeStr)(input);
        (0, globals_1.expect)(result).toBe('This is a very long string that exceeds forty-nin');
    });
    (0, globals_1.it)('should return an empty string if the input is empty', () => {
        const input = '';
        const result = (0, santize_string_1.sanitizeStr)(input);
        (0, globals_1.expect)(result).toBe('');
    });
    (0, globals_1.it)('should handle strings shorter than 49 characters without tabs', () => {
        const input = 'Short string';
        const result = (0, santize_string_1.sanitizeStr)(input);
        (0, globals_1.expect)(result).toBe('Short string');
    });
});
