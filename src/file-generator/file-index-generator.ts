import path from 'path';
import { FlatFileBaseLazy, FlatFileBaseLazyMethods, FlatFileBaseLazyOptions } from './flat-file-base-lazy';
import { SourceLine } from '../line-data';
import { LineOutputOptions } from '../line-data/line-output';
import { buildLineFromLineKeys } from '../utils';
import { replaceWithFunction } from '../utils/replace-with-function';
import { replaceWithMap } from '../utils/replace-with-map';

type FileIndexGeneratorOptions = FlatFileBaseLazyOptions &
  Omit<LineOutputOptions, 'uniqueKey' | 'indexFile' | 'rowReferences'> &
  Required<Pick<LineOutputOptions, 'uniqueKey' | 'indexFile' | 'rowReferences'>>;

export class FileIndexGenerator extends FlatFileBaseLazy implements FlatFileBaseLazyMethods {
  options: FileIndexGeneratorOptions;
  rowReferences: Set<string | number>;

  constructor(options: FileIndexGeneratorOptions) {
    options.path = path.dirname(options.indexFile);
    super(options);
    this.options = options;
    this.rowReferences = options.rowReferences;
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
    // Nothing to do in here
  }

  trackReference({ jsonLine }: SourceLine) {
    const key = jsonLine[this.options.uniqueKey];
    this.rowReferences.add(key);
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
    return '\n' + row;
  }

  isRowExist({ jsonLine }: SourceLine) {
    return !!this.rowReferences.has(jsonLine[this.options.uniqueKey]);
  }

  push(sourceLine: SourceLine) {
    if (!this.filename) {
      this.setFilename(sourceLine);
    }

    if (!this.writeStream) {
      this.createStream({ flags: 'w' });
    }

    if (this.isRowExist(sourceLine)) return;

    // Update set references
    this.trackReference(sourceLine);

    // Update index file
    const row = this.buildRow(sourceLine);
    this.writeStream?.write(row);
  }
}
