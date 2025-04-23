"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeStr = sanitizeStr;
function sanitizeStr(string) {
    const maxCharacterLimit = string.slice(0, 49);
    const finalValue = maxCharacterLimit.replace(/\t/g, ' ');
    return finalValue;
}
