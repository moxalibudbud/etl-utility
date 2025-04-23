"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const source_line_1 = require("../../../line-data/source-line");
(0, globals_1.describe)('SourceLine test 1', () => {
    const line = 'RE1-J426-BAT	128770527	143	3	2222';
    const options = {
        columns: ['store', 'sku', 'quantity', 'sohQuantity', 'countId'],
        mandatoryFields: ['store', 'sku', 'quantity', 'countId'],
        identifierMappings: { store: 'store', sku: 'sku', quantity: 'quantity' },
        outputMappings: { store: 'store', sku: 'sku', quantity: 'quantity', ccid: 'store' },
        separator: '\t',
        withHeader: true,
    };
    const sourceLine = new source_line_1.SourceLine(line, Object.assign(Object.assign({}, options), { currentLineNumber: 2 }));
    (0, globals_1.it)('should correctly parse the line into properties', () => {
        (0, globals_1.expect)(sourceLine.line).toEqual(['RE1-J426-BAT', '128770527', '143', '3', '2222']);
        (0, globals_1.expect)(sourceLine.columns).toEqual(['store', 'sku', 'quantity', 'sohQuantity', 'countId']);
        (0, globals_1.expect)(sourceLine.jsonLine).toEqual({
            store: 'RE1-J426-BAT',
            sku: '128770527',
            quantity: '143',
            sohQuantity: '3',
            countId: '2222',
        });
    });
    (0, globals_1.it)('should correctly identify "tab" separator', () => {
        (0, globals_1.expect)(sourceLine.separator).toBe('\t');
    });
    (0, globals_1.it)('should fail because seperator is "tab"', () => {
        (0, globals_1.expect)(sourceLine.separator).not.toBe(';');
    });
    (0, globals_1.it)('should validate the line correctly', () => {
        sourceLine.validate();
        (0, globals_1.expect)(sourceLine.isValid).toBe(true);
        (0, globals_1.expect)(sourceLine.error).toBe('');
    });
    (0, globals_1.it)('should correctly identify if the line is a header', () => {
        (0, globals_1.expect)(sourceLine.isHeader).toBe(false);
    });
    (0, globals_1.it)('should correctly map identifiers', () => {
        (0, globals_1.expect)(sourceLine.identifiers).toEqual({
            store: 'RE1-J426-BAT',
            sku: '128770527',
            quantity: '143',
        });
    });
    (0, globals_1.it)('should correctly map output fields', () => {
        (0, globals_1.expect)(sourceLine.output).toEqual({
            store: 'RE1-J426-BAT',
            ccid: 'RE1-J426-BAT',
            sku: '128770527',
            quantity: '143',
        });
    });
});
