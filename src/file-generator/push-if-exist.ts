import { FlatFileBaseLazyMethods, FlatFileBaseLazyOptions } from '../types';
import { FlatFileBaseLazy } from './flat-file-base-lazy';
import { SourceLine } from '../line-data';
import { LineOutputOptions } from '../line-data/line-output';
import { buildLineFromLineKeys, setFilename } from '../utils';
import { replaceWithFunction } from '../utils/replace-with-function';
import { replaceWithMap } from '../utils/replace-with-map';

type PushIfExistGeneratorOptions = FlatFileBaseLazyOptions &
  Omit<LineOutputOptions, 'uniqueKey'> &
  Required<Pick<LineOutputOptions, 'uniqueKey'>> & {
    indexFile?: string;
    rowReferences: Set<string | number>;
  };

export class PushIfExistGenerator extends FlatFileBaseLazy implements FlatFileBaseLazyMethods {
  options: PushIfExistGeneratorOptions;
  rowReferences: Set<string | number>;

  constructor(options: PushIfExistGeneratorOptions) {
    super(options);
    this.rowReferences = options.rowReferences;
    this.options = options;
  }

  setFilename(line: SourceLine) {
    this.filename = setFilename(this.options.filename, { line, metadata: this.metadata });
  }

  pushFooter() {
    if (this.options?.footer) {
      this.writeStream?.write(this.options?.footer);
    }
  }

  pushHeader(line: SourceLine) {
    if (!this.options.header) return;

    const headerRow = replaceWithFunction(this.options.header, line.allData);

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

    if (this.isRowExist(sourceLine)) {
      const row = this.buildRow(sourceLine);
      this.writeStream?.write(row);
    }
  }
}
