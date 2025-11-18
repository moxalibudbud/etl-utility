"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OctoplusSourceLine = void 0;
const source_line_base_1 = require("../../../line-data/source-line-base");
const utils_1 = require("../../../utils");
const sku_serial_1 = require("../../..//utils/sku-serial");
class OctoplusSourceLine extends source_line_base_1.SourceLineBase {
    constructor(line, options) {
        super(line, options);
    }
    get output() {
        const { skuField } = this.options;
        const octoplusSKU = this.jsonLine[skuField];
        const { sku, serial, isSerialized } = (0, sku_serial_1.skuSerial)(octoplusSKU).decode();
        const jsonLine = Object.assign(Object.assign({}, this.jsonLine), { octoplus_sku: sku, octoplus_batchsn: serial, octoplus_is_serialized: isSerialized });
        const output = (0, utils_1.mapWithDefault)(jsonLine || {}, this.options.outputMappings);
        return output;
    }
}
exports.OctoplusSourceLine = OctoplusSourceLine;
