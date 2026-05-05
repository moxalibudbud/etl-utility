"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.output = exports.line = void 0;
const tslib_1 = require("tslib");
const etl_1 = require("../../../../etl");
const default_generator_1 = require("../../../../file-generator/default-generator");
const path_1 = tslib_1.__importDefault(require("path"));
exports.line = {
    columns: [
        'count_id',
        'LABEL_DOC',
        'store',
        'STOCK_LOCATION',
        'DATE',
        'STATUS_DOC',
        'sku',
        'EXPECTED_QUANTITY_LINE',
        'counted',
        'GAP_QUANTITY_LINE',
        'STATUS_LINE',
        'FAMILY',
    ],
    mandatoryFields: [],
    identifierMappings: {},
    outputMappings: {},
    separator: ';',
    withHeader: true,
};
exports.output = {
    filename: {
        template: 'STK_[return args.metadata.timestamp]_{store}.dat',
    },
    header: 'FTAIL|[return args.store]|[return args.count_id]',
    template: 'FDETL|[return args.metadata.timestamp]||{sku}|{counted}||',
    footer: '\nFTAIL|',
    separator: '|',
    uniqueKey: 'sku',
};
function run(etl) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        try {
            const result = yield etl.process();
            console.log(result);
        }
        catch (error) {
            console.log(error);
        }
    });
}
const etlOptions = {
    filesource: {
        file: path_1.default.resolve('/var/tmp', 'OINV.csv'),
    },
    line: exports.line,
};
const etl = new etl_1.ETL(etlOptions, new default_generator_1.DefaultGenerator(Object.assign(Object.assign({}, exports.output), { metadata: { timestamp: Date.now() } })));
run(etl);
