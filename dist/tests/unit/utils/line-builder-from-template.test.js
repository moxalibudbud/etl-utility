"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const line_builder_from_template_1 = require("../../../utils/line-builder-from-template");
(0, globals_1.describe)('buildLineFromTemplate', () => {
    (0, globals_1.it)('should replace placeholders in the template with corresponding values from the line object', () => {
        const line = { name: 'John', age: '30', city: 'New York' };
        const config1 = { template: 'Name: {name}, Age: {age}, City: {city}' };
        const result1 = (0, line_builder_from_template_1.buildLineFromTemplate)(line, config1);
        (0, globals_1.expect)(result1).toBe('Name: John, Age: 30, City: New York');
        const config2 = { template: '{name}|{age}|{city}' };
        const result2 = (0, line_builder_from_template_1.buildLineFromTemplate)(line, config2);
        (0, globals_1.expect)(result2).toBe('John|30|New York');
    });
    (0, globals_1.it)('should replace placeholders with an empty string if the key is missing in the line object', () => {
        const line = { name: 'John', age: '30' };
        const config = { template: 'Name: {name}, Age: {age}, City: {city}' };
        const result = (0, line_builder_from_template_1.buildLineFromTemplate)(line, config);
        (0, globals_1.expect)(result).toBe('Name: John, Age: 30, City: ');
    });
    (0, globals_1.it)('should return the template unchanged if there are no placeholders', () => {
        const line = { name: 'John', age: '30', city: 'New York' };
        const config = { template: 'No placeholders here' };
        const result = (0, line_builder_from_template_1.buildLineFromTemplate)(line, config);
        (0, globals_1.expect)(result).toBe('No placeholders here');
    });
    (0, globals_1.it)('should handle an empty line object gracefully', () => {
        const line = {};
        const config = { template: 'Name: {name}, Age: {age}, City: {city}' };
        const result = (0, line_builder_from_template_1.buildLineFromTemplate)(line, config);
        (0, globals_1.expect)(result).toBe('Name: , Age: , City: ');
    });
});
