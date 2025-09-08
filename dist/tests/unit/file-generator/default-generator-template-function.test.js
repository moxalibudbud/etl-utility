"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const index_1 = require("../../../index");
const LINE = 'store123;sku000001;5';
const sourceLineOps = {
    columns: ['store', 'sku', 'quantity'],
    mandatoryFields: ['store', 'sku', 'quantity'],
    identifierMappings: { store: 'store', sku: 'sku' },
    outputMappings: { store: 'store', sku: 'sku', quantity: 'quantity' },
    separator: ';',
    withHeader: true,
};
const sourceLine = new index_1.SourceLine(LINE, Object.assign(Object.assign({}, sourceLineOps), { currentLineNumber: 2 }));
(0, globals_1.describe)('default-generator tests', () => {
    const options = {
        filename: (args) => `${sourceLine.jsonLine.store}_fixed_filename.txt`,
        header: (args) => `sample header|${sourceLine.jsonLine.store}`,
        footer: 'sample footer',
        separator: ';',
        template: function ({ jsonLine }) {
            return Array.from({ length: parseInt(jsonLine.quantity) }, (_, i) => jsonLine.sku).join('\n');
        },
    };
    const generator = new index_1.DefaultGenerator(options);
    (0, globals_1.test)('DefaultGenerator.buildRow() must return correct template value', () => {
        const row = generator.buildRow(sourceLine);
        (0, globals_1.expect)(row).toBe(`\nsku000001\nsku000001\nsku000001\nsku000001\nsku000001`);
    });
});
