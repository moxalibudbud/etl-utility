"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIndexArray = getIndexArray;
exports.loadIndexAsArray = loadIndexAsArray;
exports.loadIndexAsArrayAsync = loadIndexAsArrayAsync;
exports.loadIndexSet = loadIndexSet;
exports.loadIndexAsSetAsync = loadIndexAsSetAsync;
const tslib_1 = require("tslib");
const fs_1 = tslib_1.__importDefault(require("fs"));
const promises_1 = tslib_1.__importDefault(require("fs/promises"));
function getIndexArray(content) {
    const indexArray = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    return indexArray;
}
function loadIndexAsArray(indexPath) {
    const content = fs_1.default.readFileSync(indexPath, 'utf8');
    return getIndexArray(content);
}
function loadIndexAsArrayAsync(indexPath) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        const content = yield promises_1.default.readFile(indexPath, 'utf8');
        return getIndexArray(content);
    });
}
function loadIndexSet(indexPath) {
    const content = fs_1.default.readFileSync(indexPath, 'utf8');
    const array = getIndexArray(content);
    return new Set(array);
}
function loadIndexAsSetAsync(indexPath) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        const content = yield promises_1.default.readFile(indexPath, 'utf8');
        const array = getIndexArray(content);
        return new Set(array);
    });
}
