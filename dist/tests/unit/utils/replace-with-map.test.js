"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const replace_with_map_1 = require("../../../utils/replace-with-map");
(0, globals_1.describe)('replaceWithMap', () => {
    (0, globals_1.it)('should replace placeholders in the template with corresponding values from the line object', () => {
        const line = { name: 'John', age: '30', city: 'New York' };
        const template1 = 'Name: {name}, Age: {age}, City: {city}';
        const result1 = (0, replace_with_map_1.replaceWithMap)(template1, line);
        (0, globals_1.expect)(result1).toBe('Name: John, Age: 30, City: New York');
        const template2 = '{name}|{age}|{city}';
        const result2 = (0, replace_with_map_1.replaceWithMap)(template2, line);
        (0, globals_1.expect)(result2).toBe('John|30|New York');
    });
    (0, globals_1.it)('should replace placeholders with an empty string if the key is missing in the line object', () => {
        const line = { name: 'John', age: '30' };
        const template = 'Name: {name}, Age: {age}, City: {city}';
        const result = (0, replace_with_map_1.replaceWithMap)(template, line);
        (0, globals_1.expect)(result).toBe('Name: John, Age: 30, City: ');
    });
    (0, globals_1.it)('should return the template unchanged if there are no placeholders', () => {
        const line = { name: 'John', age: '30', city: 'New York' };
        const template = 'No placeholders here';
        const result = (0, replace_with_map_1.replaceWithMap)(template, line);
        (0, globals_1.expect)(result).toBe('No placeholders here');
    });
    (0, globals_1.it)('should handle an empty line object gracefully', () => {
        const line = {};
        const template = 'Name: {name}, Age: {age}, City: {city}';
        const result = (0, replace_with_map_1.replaceWithMap)(template, line);
        (0, globals_1.expect)(result).toBe('Name: , Age: , City: ');
    });
});
