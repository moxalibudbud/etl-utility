// TODO: Work on this

import { FlatFileBaseLazy, FlatFileBaseLazyMethods, FlatFileBaseLazyOptions } from './flat-file-base-lazy';
import { SourceLine } from '../line-data';
import { LineOutputOptions } from '../line-data/line-output';
import { buildLineFromLineKeys } from '../utils';
import { replaceWithFunction } from '../utils/replace-with-function';
import { replaceWithMap } from '../utils/replace-with-map';

export class DefaultGenerator extends FlatFileBaseLazy implements FlatFileBaseLazyMethods {
  options: FlatFileBaseLazyOptions & LineOutputOptions;

  constructor(options: FlatFileBaseLazyOptions & LineOutputOptions) {
    super(options);

    this.options = options;
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

    const footerRow = typeof footer === 'function' ? footer({}) : footer;
    this.writeStream?.write(footerRow);
  }

  pushHeader(line: SourceLine) {
    const header = this.options.header;

    if (!header) return;

    const headerRow = typeof header === 'function' ? header(line) : header;
    this.createHeader(headerRow);
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

    return row;
  }

  push(SourceLine: SourceLine) {
    if (!this.filename) {
      this.setFilename(SourceLine);
    }

    if (!this.writeStream) {
      this.createStream();
      this.pushHeader(SourceLine);
    }

    const row = this.buildRow(SourceLine);
    this.writeStream?.write(row);
  }
}
