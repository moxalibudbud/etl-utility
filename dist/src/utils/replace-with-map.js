"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replaceWithMap = replaceWithMap;
function replaceWithMap(template, data) {
    let output = template.replace(/\{(\w+)\}/g, (_, key) => {
        return data[key] != null ? data[key] : '';
    });
    return output;
}
