"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlatFileBase = void 0;
const tslib_1 = require("tslib");
const fs_1 = require("fs");
class FlatFileBase {
    constructor(options) {
        const path = (options === null || options === void 0 ? void 0 : options.path) ? options.path : '/var/tmp';
        this.filename = options.filename;
        this.filepath = `${path}/${this.filename}`;
        this.writeStream = (0, fs_1.createWriteStream)(this.filepath);
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
                (0, fs_1.unlink)(this.filepath, (e) => {
                    resolve(e);
                });
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
}
exports.FlatFileBase = FlatFileBase;
