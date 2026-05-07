import { FlatFileBaseLazy } from './flat-file-base-lazy';
import { SourceLine } from '../line-data';
import { LineOutputOptions } from '../line-data/line-output';
import { buildLineFromLineKeys } from '../utils';
import { replaceWithFunction } from '../utils/replace-with-function';
import { replaceWithMap } from '../utils/replace-with-map';
import { FlatFileBaseLazyMethods, FlatFileBaseLazyOptions } from '../types';

export class DefaultGenerator extends FlatFileBaseLazy implements FlatFileBaseLazyMethods {
  options: FlatFileBaseLazyOptions & LineOutputOptions;
  rowReferences = new Set<number | string>();

  constructor(options: FlatFileBaseLazyOptions & LineOutputOptions) {
    super(options);

    this.options = options;
  }

  setFilename(line: SourceLine) {
    const { filename } = this.options;

    if (typeof filename === 'object' && filename !== null) {
      const metadata = { ...line.allData, metadata: this.options.metadata };
      this.filename = replaceWithFunction(replaceWithMap(filename.template, line.jsonLine), metadata);
    } else {
      this.filename = filename;
    }
  }

  pushFooter() {
    if (this.options?.footer) {
      this.writeStream?.write(this.options?.footer);
    }
  }

  pushHeader(line: SourceLine) {
    if (!this.options.header) return;

    const metadata = { ...line.allData, metadata: this.options.metadata };
    const headerRow = replaceWithFunction(this.options.header, metadata);

    // For headers to add new row
    this.createHeader(headerRow) + '\n';
  }

  buildRow(line: SourceLine) {
    let row = '';

    if (typeof this.options.template === 'string') {
      const metadata = { ...line.allData, metadata: this.options.metadata || {} };
      row = replaceWithFunction(replaceWithMap(this.options.template, line.jsonLine), metadata);
    } else {
      const { separator } = this.options;
      row = buildLineFromLineKeys(line.output, { separator });
    }

    // Only append new line for incoming row.
    // This will prevent an empty row in the file
    return line.isHeader ? row : '\n' + row;
  }

  isRowExist({ jsonLine }: SourceLine) {
    if (this.options.uniqueKey) {
      return !!this.rowReferences.has(jsonLine[this.options.uniqueKey]);
    }
  }

  accumulateNumberValue({ jsonLine }: SourceLine) {
    if (this.options.uniqueKey) {
      return !!this.rowReferences.has(jsonLine[this.options.uniqueKey]);
    }
  }

  trackReference({ jsonLine }: SourceLine) {
    if (this.options.uniqueKey) {
      const key = jsonLine[this.options.uniqueKey];
      this.rowReferences.add(key);
    }
  }

  push(sourceLine: SourceLine) {
    const isRowExist = this.isRowExist(sourceLine);

    if (!this.filename) {
      this.setFilename(sourceLine);
    }

    if (!this.writeStream) {
      this.createStream();
      this.pushHeader(sourceLine);
    }

    if (isRowExist) return;

    const row = this.buildRow(sourceLine);
    this.writeStream?.write(row);
    this.trackReference(sourceLine);
  }
}
