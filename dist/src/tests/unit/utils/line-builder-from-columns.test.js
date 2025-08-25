"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const line_builder_from_columns_1 = require("../../../utils/line-builder-from-columns");
(0, globals_1.describe)('buildLineFromColumns', () => {
    (0, globals_1.it)('should build a line using the specified columns and default separator', () => {
        const line = { name: 'John', age: '30', city: 'New York' };
        const options = { columns: ['name', 'age', 'city'] };
        const result = (0, line_builder_from_columns_1.buildLineFromColumns)(line, options);
        (0, globals_1.expect)(result).toBe('John|30|New York\n');
    });
    (0, globals_1.it)('should build a line using the specified columns and custom separator', () => {
        const line = { name: 'John', age: '30', city: 'New York' };
        const options = { columns: ['name', 'age', 'city'], separator: ',' };
        const result = (0, line_builder_from_columns_1.buildLineFromColumns)(line, options);
        (0, globals_1.expect)(result).toBe('John,30,New York\n');
    });
    (0, globals_1.it)('should handle missing keys in the line object by blank for those columns', () => {
        const line = { name: 'John', age: '30', region: 'NCR' };
        const options = { columns: ['name', 'age', 'city', 'province', 'region'] };
        const result = (0, line_builder_from_columns_1.buildLineFromColumns)(line, options);
        (0, globals_1.expect)(result).toBe('John|30|||NCR\n');
    });
    (0, globals_1.it)('should return an empty line if no columns are specified', () => {
        const line = { name: 'John', age: '30', city: 'New York' };
        const options = { columns: [] };
        const result = (0, line_builder_from_columns_1.buildLineFromColumns)(line, options);
        (0, globals_1.expect)(result).toBe('\n');
    });
});
