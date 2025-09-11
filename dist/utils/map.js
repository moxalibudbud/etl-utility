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
        if (typeof rule === 'string' && rule.startsWith('[') && rule.endsWith(']')) {
            const fnBody = rule.slice(1, -1).trim();
            try {
                const fn = new Function('input', fnBody);
                result[outputKey] = fn(input);
            }
            catch (err) {
                console.error(`Error executing function for key "${fnBody}":`, err);
                result[outputKey] = outputKey;
            }
        }
        else {
            result[outputKey] = input.hasOwnProperty(rule) ? input[rule] : rule;
        }
    }
    return result;
}
