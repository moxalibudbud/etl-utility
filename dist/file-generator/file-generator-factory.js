"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileGeneratorFactory = FileGeneratorFactory;
const default_generator_1 = require("./default-generator");
const push_if_exist_1 = require("./push-if-exist");
const file_index_generator_1 = require("./file-index-generator");
const json_generator_1 = require("./json-generator");
function FileGeneratorFactory(fileGenerator) {
    if (fileGenerator === 'push-if-exist') {
        return push_if_exist_1.PushIfExistGenerator;
    }
    else if (fileGenerator === 'file-index-generator') {
        return file_index_generator_1.FileIndexGenerator;
    }
    else if (fileGenerator === 'json-generator') {
        return json_generator_1.JSONGenerator;
    }
    else {
        return default_generator_1.DefaultGenerator;
    }
}
