"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlatFileBaseLazy = void 0;
const tslib_1 = require("tslib");
const fs_1 = require("fs");
class FlatFileBaseLazy {
    constructor(options) {
        this._filename = '';
        this.path = (options === null || options === void 0 ? void 0 : options.path) ? options.path : '/var/tmp';
    }
    createStream() {
        this.writeStream = (0, fs_1.createWriteStream)(this.filepath);
    }
    createHeader(header) {
        if (this.writeStream) {
            this.writeStream.write(header);
        }
    }
    end() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => {
                if (this.writeStream) {
                    this.writeStream.end(() => {
                        var _a;
                        (_a = this.writeStream) === null || _a === void 0 ? void 0 : _a.removeAllListeners();
                        resolve({});
                    });
                }
                else {
                    resolve({});
                }
            });
        });
    }
    delete() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const removeFile = (resolve) => {
                if (this.filename && (0, fs_1.existsSync)(this.filepath)) {
                    (0, fs_1.unlink)(this.filepath, (e) => {
                        resolve(e);
                    });
                }
                else {
                    resolve();
                }
            };
            return new Promise((resolve, reject) => {
                try {
                    removeFile(resolve);
                }
                catch (e) {
                    reject(e);
                }
            });
        });
    }
    get filepath() {
        return `${this.path}/${this._filename}`;
    }
    get filename() {
        return this._filename;
    }
    set filename(filename) {
        this._filename = filename;
    }
}
exports.FlatFileBaseLazy = FlatFileBaseLazy;
