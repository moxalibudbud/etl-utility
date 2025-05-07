"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const utils_1 = require("../../../utils");
(0, globals_1.describe)('lineDataToJSON', () => {
    (0, globals_1.it)('should map fields to corresponding values', () => {
        const fields = ['name', 'age', 'city'];
        const values = ['John', '30', 'New York'];
        const result = (0, utils_1.lineDataToJSON)(fields, values);
        (0, globals_1.expect)(result).toEqual({
            name: 'John',
            age: '30',
            city: 'New York',
        });
    });
    (0, globals_1.it)('should handle empty fields and values', () => {
        const fields = [];
        const values = [];
        const result = (0, utils_1.lineDataToJSON)(fields, values);
        (0, globals_1.expect)(result).toEqual({});
    });
    (0, globals_1.it)('should handle mismatched fields and values', () => {
        const fields = ['name', 'age'];
        const values = ['John'];
        const result = (0, utils_1.lineDataToJSON)(fields, values);
        (0, globals_1.expect)(result).toEqual({
            name: 'John',
            age: undefined,
        });
    });
});
