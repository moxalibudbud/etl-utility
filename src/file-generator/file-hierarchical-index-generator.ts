import fs from 'fs';
import { FlatFileBaseLazy, FlatFileBaseLazyMethods, FlatFileBaseLazyOptions } from './flat-file-base-lazy';
import { SourceLine } from '../line-data';
import { LineOutputOptions } from '../line-data/line-output';
import { fileHierarchicalManager, buildLineFromLineKeys } from '../utils';
import { replaceWithFunction } from '../utils/replace-with-function';
import { replaceWithMap } from '../utils/replace-with-map';
import path from 'path';

type FileHierarchicalIndexGeneratorOptions = FlatFileBaseLazyOptions &
  Omit<LineOutputOptions, 'uniqueKey'> &
  Required<Pick<LineOutputOptions, 'uniqueKey'>> & {
    indexFile: string;
    indexDir: string;
  };

export class FileHierarchicalIndexGenerator extends FlatFileBaseLazy implements FlatFileBaseLazyMethods {
  options: FileHierarchicalIndexGeneratorOptions;
  rowReferences = new Set<number | string>();
  fileHierarchicalManager?: any;

  constructor(options: FileHierarchicalIndexGeneratorOptions) {
    options.path = path.dirname(options.indexFile);
    super(options);
    this.options = options;
    this.fileHierarchicalManager = fileHierarchicalManager(options.indexDir);
    this.loadIndex();
  }

  loadIndex() {
    try {
      if (!fs.existsSync(this.options.indexFile)) return;

      console.log('Loading index...');
      const content = fs.readFileSync(this.options.indexFile, 'utf8');
      const indexArray = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      this.rowReferences = new Set(indexArray);
      console.log(`Loaded ${indexArray.length} SKUs into memory.`);
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
    return line.currentLineNumber == 2 ? row : '\n' + row;
  }

  isRowExist({ jsonLine }: SourceLine) {
    return !!this.rowReferences.has(jsonLine[this.options.uniqueKey]);
  }

  createIndexReference({ jsonLine }: SourceLine) {
    const key = jsonLine[this.options.uniqueKey];
    const indexPath = this.fileHierarchicalManager.createDirectoryStructure(key);
    fs.writeFileSync(indexPath, '.', 'utf-8');
  }

  push(sourceLine: SourceLine) {
    if (!this.filename) {
      this.setFilename(sourceLine);
    }

    if (!this.writeStream) {
      this.createStream({ flags: 'a' });
    }

    if (this.isRowExist(sourceLine)) return;

    // Push hierarchy index file reference
    this.createIndexReference(sourceLine);

    // Update set references
    this.trackReference(sourceLine);

    // Update index file
    const row = this.buildRow(sourceLine);
    this.writeStream?.write(row);
  }
}
