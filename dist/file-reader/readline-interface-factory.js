"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadLineInterfaceType = void 0;
exports.readLineInterface = readLineInterface;
const blob_reader_1 = require("./blob-reader");
const file_reader_1 = require("./file-reader");
var ReadLineInterfaceType;
(function (ReadLineInterfaceType) {
    ReadLineInterfaceType["Blob"] = "blob";
    ReadLineInterfaceType["File"] = "file";
})(ReadLineInterfaceType || (exports.ReadLineInterfaceType = ReadLineInterfaceType = {}));
function readLineInterface(source, type) {
    if (type == ReadLineInterfaceType.Blob) {
        return new blob_reader_1.BlobReader(source);
    }
    else {
        return new file_reader_1.FileReader(source);
    }
}
