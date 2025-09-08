import { describe, expect, test } from '@jest/globals';
import { DefaultGenerator, LineOutputOptions, SourceLine } from '../../../index';

const LINE = 'RE1-J426-BAT	128770527	143	3	2222';
const sourceLineOps = {
  columns: ['store', 'sku', 'quantity', 'sohQuantity', 'countId'],
  mandatoryFields: ['store', 'sku', 'quantity', 'countId'],
  identifierMappings: { store: 'store', sku: 'sku', quantity: 'quantity' },
  outputMappings: { store: 'store', sku: 'sku', quantity: 'quantity', ccid: 'store' },
  separator: '\t',
  withHeader: true,
};

const sourceLine = new SourceLine(LINE, { ...sourceLineOps, currentLineNumber: 2 });

describe('default-generator tests', () => {
  const options: LineOutputOptions = {
    // filename: 'fixed_filename.txt',
    filename: (args: SourceLine) => `${sourceLine.jsonLine.store}_fixed_filename.txt`,
    // header: 'sample header\n',
    // footer: 'sample footer',
    header: (args: SourceLine) => `sample header|${sourceLine.jsonLine.store}`,
    footer: 'sample footer',
    separator: ';',
    template: '{store};{sku};{quantity};{countId}',
  };
  const generator = new DefaultGenerator(options);

  test('DefaultGenerator.filename must be correct', () => {
    generator.setFilename(sourceLine);
    expect(generator.filename).toBe(`RE1-J426-BAT_fixed_filename.txt`);
  });

  test('DefaultGenerator.buildRow() must return correct template value', () => {
    const row = generator.buildRow(sourceLine);
    expect(row).toBe('\nRE1-J426-BAT;128770527;143;2222');
  });

  test('DefaultGenerator.push() must generate file', () => {
    generator.push(sourceLine);
    generator.pushFooter();
  });
});
