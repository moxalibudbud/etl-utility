"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const default_generator_1 = require("../../../file-generator/default-generator");
const line_data_1 = require("../../../line-data");
const LINE = 'RE1-J426-BAT	128770527	143	3	2222';
const sourceLineOps = {
    columns: ['store', 'sku', 'quantity', 'sohQuantity', 'countId'],
    mandatoryFields: ['store', 'sku', 'quantity', 'countId'],
    identifierMappings: { store: 'store', sku: 'sku', quantity: 'quantity' },
    outputMappings: { store: 'store', sku: 'sku', quantity: 'quantity', ccid: 'store' },
    separator: '\t',
    withHeader: true,
};
const sourceLine = new line_data_1.SourceLine(LINE, Object.assign(Object.assign({}, sourceLineOps), { currentLineNumber: 2 }));
(0, globals_1.describe)('default-generator tests', () => {
    const options = {
        filename: (args) => `${sourceLine.jsonLine.store}_fixed_filename.txt`,
        header: (args) => `sample header|${sourceLine.jsonLine.store}\n`,
        footer: 'sample footer',
        separator: ';',
        columns: ['store', 'sku', 'quantity', 'countId'],
        template: '{store};{sku};{quantity};{countId}',
    };
    const generator = new default_generator_1.DefaultGenerator(options);
    (0, globals_1.test)('DefaultGenerator.filename must be correct', () => {
        generator.setFilename(sourceLine);
        (0, globals_1.expect)(generator.filename).toBe(`RE1-J426-BAT_fixed_filename.txt`);
    });
    (0, globals_1.test)('DefaultGenerator.buildRow() must return correct template value', () => {
        const row = generator.buildRow(sourceLine);
        (0, globals_1.expect)(row).toBe(`RE1-J426-BAT;128770527;143;2222\n`);
    });
    (0, globals_1.test)('DefaultGenerator.push() must generate file', () => {
        generator.push(sourceLine);
        generator.pushFooter();
    });
});
