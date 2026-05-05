"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.customFunction = customFunction;
function customFunction(fnBody, args, defaultValue) {
    try {
        const fn = new Function('args', fnBody);
        const result = fn(args);
        return result;
    }
    catch (_a) {
        return defaultValue;
    }
}
