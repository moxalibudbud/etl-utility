"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlobReader = void 0;
const tslib_1 = require("tslib");
const azure_blob_1 = require("@altavant/azure-blob");
const read_line_base_1 = require("./read-line-base");
class BlobReader extends read_line_base_1.ReadLineBase {
    constructor(url) {
        super(url);
    }
    getReadStream() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const [accountName, accountKey] = [
                process.env.AZURE_BLOB_STORAGE_ACCOUNT_NAME,
                process.env.AZURE_BLOB_STORAGE_ACCOUNT_KEY,
            ];
            const client = (0, azure_blob_1.serviceClient)(accountName, accountKey);
            const blobClient = yield client.blobClient(this.url);
            const { readableStreamBody } = yield blobClient.download(0);
            return readableStreamBody;
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
