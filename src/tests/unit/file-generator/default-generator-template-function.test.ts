import { describe, expect, test } from '@jest/globals';
import { DefaultGenerator, LineOutputOptions, SourceLine } from '../../../index';

const LINE = 'store123;sku000001;5';
const sourceLineOps = {
  columns: ['store', 'sku', 'quantity'],
  mandatoryFields: ['store', 'sku', 'quantity'],
  identifierMappings: { store: 'store', sku: 'sku' },
  outputMappings: { store: 'store', sku: 'sku', quantity: 'quantity' },
  separator: ';',
  withHeader: true,
};

const sourceLine = new SourceLine(LINE, { ...sourceLineOps, currentLineNumber: 2 });

describe('default-generator tests', () => {
  const options: LineOutputOptions = {
    filename: (args: SourceLine) => `${sourceLine.jsonLine.store}_fixed_filename.txt`,
    header: (args: SourceLine) => `sample header|${sourceLine.jsonLine.store}\n`,
    footer: 'sample footer',
    separator: ';',
    template: function ({ jsonLine }: SourceLine) {
      return Array.from({ length: parseInt(jsonLine.quantity) }, (_, i) => jsonLine.sku).join('\n') + '\n';
    },
  };
  const generator = new DefaultGenerator(options);

  test('DefaultGenerator.buildRow() must return correct template value', () => {
    const row = generator.buildRow(sourceLine);
    expect(row).toBe(`sku000001\nsku000001\nsku000001\nsku000001\nsku000001\n`);
  });
});
