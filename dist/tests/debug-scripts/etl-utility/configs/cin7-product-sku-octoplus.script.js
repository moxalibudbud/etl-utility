"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const etl_1 = require("../../../../etl");
const default_generator_1 = require("../../../../file-generator/default-generator");
const config = tslib_1.__importStar(require("./cin7-product-sku-octoplus"));
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
            sku: '1000000000001',
            external_barcode: '1000000000001',
            internal_barcode: '1000000000009',
            external_product_id: 'ca74dced-49ff-4a21-b3b9-3bd7862fe690',
            AverageCost: 5,
            Category: 'Other',
            ID: 'ca74dced-49ff-4a21-b3b9-3bd7862fe690',
            LastModifiedOn: '2025-09-29T17:44:00.657Z',
            Name: 'Altavant Product 2222222',
            PriceTier1: 0,
            PriceTier2: 0,
            ShortDescription: '',
            UOM: 'Item',
        },
        {
            sku: '100720251745',
            external_barcode: '100720251745',
            internal_barcode: '1007202517458',
            external_product_id: '5fe9ecae-a70f-4ad1-bc78-c4562d4b6c96',
            AverageCost: 32131.5224,
            Category: 'Road Bike',
            ID: '5fe9ecae-a70f-4ad1-bc78-c4562d4b6c96',
            LastModifiedOn: '2025-09-12T12:55:54.95Z',
            Name: 'Custom Bike Colnago Y1Rs Sram Force Ses 4.5 SDM5 L',
            PriceTier1: 50399,
            PriceTier2: 0,
            ShortDescription: null,
            UOM: 'Item',
        },
        {
            sku: '202412180358 - 001',
            external_barcode: '202412180358 - 001',
            internal_barcode: '2000756664905',
            external_product_id: 'f2c045b1-55f4-4450-af63-60cae8e8bc39',
            AverageCost: 39641.98,
            Category: 'Road Bike',
            ID: 'f2c045b1-55f4-4450-af63-60cae8e8bc39',
            LastModifiedOn: '2025-09-12T12:55:54.95Z',
            Name: 'Colnago Y1Rs Dura Ace Di2 SES 4.5 SDM5 XS',
            PriceTier1: 65999,
            PriceTier2: 0,
            ShortDescription: null,
            UOM: 'Item',
        },
    ],
    errorFilename: 'ETLFromJson.error',
    line: config.line,
};
const etl = new etl_1.JsonETL(etlOptions, new default_generator_1.DefaultGenerator(config.output));
run(etl);
