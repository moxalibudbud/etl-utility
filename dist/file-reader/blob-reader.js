"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlobReader = void 0;
const tslib_1 = require("tslib");
const read_line_base_1 = require("./read-line-base");
class BlobReader extends read_line_base_1.ReadLineBase {
    constructor(url) {
        super(url);
    }
    getReadStream() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const dummyStream = '';
            return dummyStream;
        });
    }
    initiateInterface() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const readStream = yield this.getReadStream();
            this.setInterface(readStream);
        });
    }
}
exports.BlobReader = BlobReader;
