"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSONGenerator = void 0;
const tslib_1 = require("tslib");
const promises_1 = tslib_1.__importDefault(require("fs/promises"));
const flat_file_base_lazy_1 = require("./flat-file-base-lazy");
const replace_with_function_1 = require("../utils/replace-with-function");
const replace_with_map_1 = require("../utils/replace-with-map");
class JSONGenerator extends flat_file_base_lazy_1.FlatFileBaseLazy {
    constructor(options) {
        super(options);
        this.rowReferences = new Set();
        this.rootData = {};
        this.arrayBuckets = new Map();
        this.options = options;
    }
    setFilename(line) {
        const { filename } = this.options;
        if (typeof filename === 'object' && filename !== null) {
            this.filename = (0, replace_with_function_1.replaceWithFunction)((0, replace_with_map_1.replaceWithMap)(filename.template, line.jsonLine));
        }
        else {
            this.filename = filename;
        }
    }
    pushFooter() {
        var _a, _b, _c;
        if ((_a = this.options) === null || _a === void 0 ? void 0 : _a.footer) {
            (_b = this.writeStream) === null || _b === void 0 ? void 0 : _b.write((_c = this.options) === null || _c === void 0 ? void 0 : _c.footer);
        }
    }
    pushHeader(line) {
        const header = (0, replace_with_function_1.replaceWithFunction)(this.options.header || '', line.allData);
        this.rootData = Object.assign({}, JSON.parse(header));
    }
    parseRootPath(path) {
        const rootMatch = path.match(/^root\.(\w+)$/);
        if (rootMatch) {
            return {
                type: 'root',
                rootKey: rootMatch[1],
            };
        }
        return {
            type: 'root',
            rootKey: 'id',
        };
    }
    parseArrayPath(path) {
        const arrayMatch = path.match(/^(\w+)\[\]\.(\w+)$/);
        if (arrayMatch) {
            return {
                type: 'array',
                arrayKey: arrayMatch[1],
                arrayField: arrayMatch[2],
            };
        }
        return {
            type: 'array',
            arrayKey: 'lines',
            arrayField: 'id',
        };
    }
    buildJson(line) {
        var _a;
        const arrayKey = ((_a = this.options) === null || _a === void 0 ? void 0 : _a.arrayField) || 'lines';
        if (!this.arrayBuckets.has(arrayKey)) {
            this.arrayBuckets.set(arrayKey, []);
        }
        const bucket = this.arrayBuckets.get(arrayKey);
        const metadata = Object.assign(Object.assign({}, line.allData), { metadata: this.options.metadata || {} });
        let item = (0, replace_with_function_1.replaceWithFunction)((0, replace_with_map_1.replaceWithMap)(this.options.template, line.jsonLine), metadata);
        bucket.push(JSON.parse(item));
    }
    isRowExist({ jsonLine }) {
        if (this.options.uniqueKey) {
            return !!this.rowReferences.has(jsonLine[this.options.uniqueKey]);
        }
    }
    trackReference({ jsonLine }) {
        if (this.options.uniqueKey) {
            const key = jsonLine[this.options.uniqueKey];
            this.rowReferences.add(key);
        }
    }
    push(sourceLine) {
        if (!this.filename) {
            this.setFilename(sourceLine);
        }
        if (!Object.keys(this.rootData).length) {
            this.pushHeader(sourceLine);
        }
        if (this.isRowExist(sourceLine))
            return;
        this.buildJson(sourceLine);
    }
    buildFinalJSON() {
        const finalJSON = Object.assign({}, this.rootData);
        const arrayKey = this.options.arrayField || 'lines';
        finalJSON[arrayKey] = this.arrayBuckets.get(arrayKey) || [];
        return finalJSON;
    }
    pushFinalJSON() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const finalJSON = this.buildFinalJSON();
            yield promises_1.default.writeFile(this.filepath, JSON.stringify(finalJSON, null, 2), 'utf-8');
        });
    }
}
exports.JSONGenerator = JSONGenerator;
