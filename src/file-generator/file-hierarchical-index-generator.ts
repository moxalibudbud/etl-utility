import fs from 'fs';
import { FlatFileBaseLazy, FlatFileBaseLazyMethods, FlatFileBaseLazyOptions } from './flat-file-base-lazy';
import { SourceLine } from '../line-data';
import { LineOutputOptions } from '../line-data/line-output';
import { buildLineFromLineKeys, FILE_HIERARCHICAL_INDEX_DIRECTORY, fileHierarchicalManager } from '../utils';
import { replaceWithFunction } from '../utils/replace-with-function';
import { replaceWithMap } from '../utils/replace-with-map';

type FileHierarchicalIndexGeneratorOptions = FlatFileBaseLazyOptions &
  Omit<LineOutputOptions, 'uniqueKey'> &
  Required<Pick<LineOutputOptions, 'uniqueKey'>> & {
    indexFile?: string;
    indexDir?: string;
  };

export class FileHierarchicalIndexGenerator extends FlatFileBaseLazy implements FlatFileBaseLazyMethods {
  options: FileHierarchicalIndexGeneratorOptions;
  rowReferences = new Set<number | string>();
  fileHierarchicalManager?: any;

  constructor(options: FileHierarchicalIndexGeneratorOptions) {
    options.indexDir = options?.indexDir || FILE_HIERARCHICAL_INDEX_DIRECTORY;
    super(options);
    this.options = options;
    this.fileHierarchicalManager = fileHierarchicalManager();
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

  push(sourceLine: SourceLine) {
    if (!this.filename) {
      this.setFilename(sourceLine);
    }

    if (!this.writeStream) {
      this.createStream();
    }

    this.writeStream?.write('.');
  }
}
