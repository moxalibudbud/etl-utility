// TODO: Work on this

import { FlatFileBaseLazy, FlatFileBaseLazyMethods, FlatFileBaseLazyOptions } from './flat-file-base-lazy';
import { SourceLine } from '../line-data';
import { LineOutputOptions } from '../line-data/line-output';
import { buildLineFromLineKeys, buildLineFromTemplate } from '../utils';

export class DefaultGenerator extends FlatFileBaseLazy implements FlatFileBaseLazyMethods {
  options: FlatFileBaseLazyOptions & LineOutputOptions;

  constructor(options: FlatFileBaseLazyOptions & LineOutputOptions) {
    super(options);

    this.options = options;
  }

  setFilename(line: SourceLine) {
    const filename = this.options.filename;
    this.filename = typeof filename === 'function' ? filename(line) : filename;
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

    if (this.options.template) {
      row = buildLineFromTemplate(line.jsonLine, { template: this.options.template });
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
