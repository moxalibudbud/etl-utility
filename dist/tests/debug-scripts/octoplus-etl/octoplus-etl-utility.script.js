"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const path_1 = tslib_1.__importDefault(require("path"));
const octoplus_etl_1 = require("./octoplus-etl");
const file_generator_1 = require("../../../file-generator");
const lineConfig = {
    columns: [
        'internalReference',
        'inventoryType',
        'label',
        'motif',
        'site',
        'siteLabel',
        'storage',
        'globalCountedQuantity',
        'globalExpectedQuantity',
        'globalGapQuantity',
        'globalStatus',
        'readingStartDate',
        'countingUser',
        'countingDate',
        'skuCode',
        'status',
        'countedQuantity',
        'expectedQuantity',
        'gapQuantity',
        'epc',
    ],
    mandatoryFields: [],
    identifierMappings: {},
    outputMappings: {
        'Zero/NonZero': "[return parseInt(input.expectedQuantity) > 0 ? 'NonZero' : 'Zero']",
        Location: 'siteLabel',
        SKU: 'octoplus_sku',
        Name: '',
        Bin: '',
        BatchSerialNumber: "[return input.octoplus_is_serialized ? input.octoplus_batchsn : '']",
        ExpiryDate_YYYYMMDD: '',
        Quantity: 'countedQuantity',
        UnitCost: '0.0001',
        Comments: '',
        ReceivedDate_YYYYMMDD: "[return new Date().toISOString().split('T')[0].replace(/-/g, '')]",
    },
    separator: ';',
    withHeader: true,
    skuField: 'skuCode',
};
const config = {
    line: lineConfig,
    output: {
        filename: {
            template: '{siteLabel} - [dateTime,YYYYMMDDHHmmss,Asia/Dubai].csv',
        },
        header: 'Zero/NonZero,Location,SKU,Name,Bin,BatchSerialNumber,ExpiryDate_YYYYMMDD,Quantity,UnitCost,Comments,ReceivedDate_YYYYMMDD',
        separator: ',',
        uniqueKey: 'skuCode',
    },
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
        file: path_1.default.resolve('/var/tmp', 'O_INV_8e79a25f-73df-499d-bcea-8c37c105b4d8_20251117_121206776.csv'),
    },
    line: config.line,
};
const etl = new octoplus_etl_1.OctoplusOutfileETL(etlOptions, new file_generator_1.DefaultGenerator(config.output));
run(etl);
