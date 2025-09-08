"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const line_builder_from_line_keys_1 = require("../../../utils/line-builder-from-line-keys");
(0, globals_1.describe)('buildLineFromLineKeys', () => {
    (0, globals_1.it)('should build a line by line keys and default separator', () => {
        const line = { name: 'John', age: '30', city: 'New York' };
        const options = {};
        const result = (0, line_builder_from_line_keys_1.buildLineFromLineKeys)(line, options);
        (0, globals_1.expect)(result).toBe('John|30|New York');
    });
    (0, globals_1.it)('should build a line by line keys and custom separator', () => {
        const line = { name: 'John', age: '30', city: 'New York' };
        const options = { separator: ',' };
        const result = (0, line_builder_from_line_keys_1.buildLineFromLineKeys)(line, options);
        (0, globals_1.expect)(result).toBe('John,30,New York');
    });
    (0, globals_1.it)('should came the numeric field value because that is how Object.keys works', () => {
        const line = { name: 'John', age: '30', 10: 'ten', city: 'New York' };
        const options = { separator: ',' };
        const result = (0, line_builder_from_line_keys_1.buildLineFromLineKeys)(line, options);
        (0, globals_1.expect)(result).toBe('ten,John,30,New York');
    });
});
