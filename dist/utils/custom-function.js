"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.customFunction = customFunction;
function customFunction(fnBody, input, defaultValue) {
    try {
        const fn = new Function('input', fnBody);
        const result = fn(input);
        return result;
    }
    catch (_a) {
        return defaultValue;
    }
}
