"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const etl_1 = require("../../../etl");
const file_generator_1 = require("../../../file-generator");
const goldItemMasterConfig = tslib_1.__importStar(require("./configs/config.gold-item-master.stoksmart"));
const MOCKDATA_DIR = 'mockdata';
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
    json: [
        {
            MESSAGEID: '',
            MAIN_BRAND: '',
            BRAND: '',
            PART_NUMBER: '1',
            BARCODE: '1',
            DESCRIPTION: '',
            DESCRIPTION_2: '',
            STYLE: '1',
            STYLE_DESCRIPTION: '',
            COLOR: '',
            COLOR_DESCRIPTION: '',
            SIZE_1: '',
            SIZE_DESCRIPTION: '',
            SIZE_2: '',
            SIZE_DESCRIPTION_2: '',
            S_PGROUP: '',
        },
    ],
    errorFilename: 'ETLFromJson',
    line: goldItemMasterConfig.line,
    destinationContainer: 'datascan-item-master',
    etlType: 'item-master',
};
const etl = new etl_1.JsonETL(etlOptions, new file_generator_1.DefaultGenerator(goldItemMasterConfig.output));
run(etl);
