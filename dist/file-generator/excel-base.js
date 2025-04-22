"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExcelBase = void 0;
const tslib_1 = require("tslib");
const fs_1 = require("fs");
const ExcelJS = tslib_1.__importStar(require("exceljs"));
class ExcelBase {
    constructor(options) {
        const path = (options === null || options === void 0 ? void 0 : options.path) ? options.path : '/var/tmp';
        this.filename = options.filename;
        this.filepath = `${path}/${this.filename}`;
        this.writeStream = new ExcelJS.stream.xlsx.WorkbookWriter({
            stream: (0, fs_1.createWriteStream)(this.filepath),
            useSharedStrings: true,
            useStyles: true,
        });
        this.worksheet = this.writeStream.addWorksheet('Sheet 1');
    }
    end() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.writeStream.commit();
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
exports.ExcelBase = ExcelBase;
