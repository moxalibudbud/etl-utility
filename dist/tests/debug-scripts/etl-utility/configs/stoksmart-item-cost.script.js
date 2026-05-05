"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.output = exports.line = void 0;
const tslib_1 = require("tslib");
const etl_1 = require("../../../../etl");
const path_1 = tslib_1.__importDefault(require("path"));
const file_generator_1 = require("src/file-generator");
exports.line = {
    columns: [
        'TYPE_MOUVEMENT',
        'CODE_ARTICLE',
        'MAIN_EAN',
        'CODE_PRODUCT',
        'SHORT_LABEL',
        'LONG_LABEL',
        'CODE_SEASON',
        'CODE_SUPPLIER',
        'CODE_FAMILY',
        'CODE_NGP',
        'CODE_COLOR',
        'CODE_SIZE',
        'PRIMARY_TYPE_TAG',
        'SECONDARY_TYPE_TAG',
        'SELLING_PRICE',
        'BUYING_PRICE',
        'URL_PICTURE',
        'TRACEABILITY_MODE',
        'SUPPLIER_REF',
        'END_PRODUCT',
        'QUANTITY',
        'UNIT',
        'FIDELITY_PRICE',
        'USERFIELD_1',
        'USERFIELD_2',
        'USERFIELD_3',
        'USERFIELD_4',
        'USERFIELD_5',
        'CODE_BRAND',
        'PRICE_COMPARISON_UNIT',
        'PRICE_COMPARISON_DIVIDER',
        'RANK',
    ],
    mandatoryFields: [],
    identifierMappings: {},
    outputMappings: {},
    separator: ';',
    withHeader: true,
};
exports.output = {
    filename: {
        template: 'stoksmart-item-cost.json',
    },
    template: '{"store": "[return args.metadata.store]", "sku": "{CODE_ARTICLE}", "cost": "{BUYING_PRICE}"}',
    header: '{"lines": []}',
    separator: ';',
    arrayField: 'lines',
    fileGenerator: 'json-generator',
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
        file: path_1.default.resolve('/var/tmp', 'ISKU.csv'),
    },
    line: exports.line,
};
const etl = new etl_1.JsonOutETL(etlOptions, new file_generator_1.JSONGenerator(Object.assign(Object.assign({}, exports.output), { metadata: { store: '8002' } })));
run(etl);
