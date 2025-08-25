"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidURL = isValidURL;
function isValidURL(url) {
    try {
        new URL(url);
        return true;
    }
    catch (e) {
        return false;
    }
}
