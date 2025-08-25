"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapFields = mapFields;
exports.mapWithDefault = mapWithDefault;
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
        if (typeof rule === 'function') {
            result[outputKey] = rule(input);
        }
        else {
            result[outputKey] = input.hasOwnProperty(rule) ? input[rule] : rule;
        }
    }
    return result;
}
