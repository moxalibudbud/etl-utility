"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapFields = mapFields;
exports.mapWithDefault = mapWithDefault;
const custom_function_1 = require("./custom-function");
function mapFields(input, config) {
    const result = {};
    for (const [outputKey, rule] of Object.entries(config)) {
        result[outputKey] = typeof rule === 'function' ? rule(input) : input[rule];
    }
    return result;
}
function mapWithDefault(input, config) {
    const result = {};
    for (const [outputKey, rule] of Object.entries(config)) {
        if (typeof rule === 'string' && rule.startsWith('[') && rule.endsWith(']')) {
            const functionBody = rule.slice(1, -1).trim();
            result[outputKey] = (0, custom_function_1.customFunction)(functionBody, input, outputKey);
        }
        else {
            result[outputKey] = input.hasOwnProperty(rule) ? input[rule] : rule;
        }
    }
    return result;
}
