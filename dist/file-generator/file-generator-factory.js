"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileGeneratorFactory = void 0;
const _1 = require(".");
const FileGeneratorFactory = (fileGenerator) => {
    if (fileGenerator === 'push-if-exist') {
        return _1.PushIfExistGenerator;
    }
    else if (fileGenerator === 'file-index-generator') {
        return _1.FileIndexGenerator;
    }
    else {
        return _1.DefaultGenerator;
    }
};
exports.FileGeneratorFactory = FileGeneratorFactory;
