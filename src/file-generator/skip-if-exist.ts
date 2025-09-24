import fs from 'fs';
import { FlatFileBaseLazy, FlatFileBaseLazyMethods, FlatFileBaseLazyOptions } from './flat-file-base-lazy';
import { SourceLine } from '../line-data';
import { LineOutputOptions } from '../line-data/line-output';
import { buildLineFromLineKeys, FILE_HIERARCHICAL_INDEX_DIRECTORY } from '../utils';
import { replaceWithFunction } from '../utils/replace-with-function';
import { replaceWithMap } from '../utils/replace-with-map';

type SkipIfExistGeneratorOptions = FlatFileBaseLazyOptions &
  Omit<LineOutputOptions, 'uniqueKey'> &
  Required<Pick<LineOutputOptions, 'uniqueKey'>> & {
    indexFile?: string;
  };

export class SkipIfExistGenerator extends FlatFileBaseLazy implements FlatFileBaseLazyMethods {
  options: SkipIfExistGeneratorOptions;
  rowReferences = new Set<number | string>();

  constructor(options: SkipIfExistGeneratorOptions) {
    super(options);
    this.options = options;

    this.loadIndex();
  }

  loadIndex() {
    try {
      console.log('Loading index...');
      const indexArray = JSON.parse(
        fs.readFileSync(this.options.indexFile || FILE_HIERARCHICAL_INDEX_DIRECTORY, 'utf8')
      );
      this.rowReferences = new Set(indexArray);
      console.log(`Loaded ${indexArray.length} SKUs into memory.`);
      return this.rowReferences;
    } catch (error) {
      console.error('Error loading SKU index:', error);
      throw new Error('SKU index not found. Please build index first.');
    }
  }

  setFilename(line: SourceLine) {
    const { filename } = this.options;

    if (typeof filename === 'function') {
      this.filename = filename(line);
    } else if (typeof filename === 'object' && filename !== null) {
      let name = replaceWithMap(filename.template, line.jsonLine);
      name = replaceWithFunction(name);
      this.filename = name;
    } else {
      this.filename = filename;
    }
  }

  pushFooter() {
    const footer = this.options?.footer;

    if (!footer) return;

    const footerRow = typeof footer === 'function' ? footer() : footer;
    this.writeStream?.write(footerRow);
  }

  pushHeader(line: SourceLine) {
    const header = this.options.header;

    if (!header) return;

    const headerRow = typeof header === 'function' ? header(line) : header;

    // For headers to add new row
    this.createHeader(headerRow) + '\n';
  }

  buildRow(line: SourceLine) {
    let row = '';

    if (typeof this.options.template === 'string') {
      row = replaceWithMap(this.options.template, line.jsonLine);
    } else if (typeof this.options.template === 'function') {
      row = this.options.template(line);
    } else {
      const { separator } = this.options;
      row = buildLineFromLineKeys(line.output, { separator });
    }

    // Only append new line for incoming row.
    // This will prevent an empty row in the file
    return line.isHeader ? row : '\n' + row;
  }

  isRowExist({ jsonLine }: SourceLine) {
    return !!this.rowReferences.has(jsonLine[this.options.uniqueKey]);
  }

  push(sourceLine: SourceLine) {
    if (!this.filename) {
      this.setFilename(sourceLine);
    }

    if (!this.writeStream) {
      this.createStream();
      this.pushHeader(sourceLine);
    }

    if (this.isRowExist(sourceLine)) return;

    const row = this.buildRow(sourceLine);
    this.writeStream?.write(row);
  }
}
