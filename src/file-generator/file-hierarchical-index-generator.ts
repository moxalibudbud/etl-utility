import fs from 'fs';
import { FlatFileBaseLazy, FlatFileBaseLazyMethods, FlatFileBaseLazyOptions } from './flat-file-base-lazy';
import { SourceLine } from '../line-data';
import { LineOutputOptions } from '../line-data/line-output';
import { fileHierarchicalManager } from '../utils';

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
    super(options);
    this.options = options;
    this.fileHierarchicalManager = fileHierarchicalManager(options.indexDir);
  }

  setFilename() {
    // Nothing to do in here
  }

  pushFooter() {
    // Nothing to do in here
  }

  push(sourceLine: SourceLine) {
    const indexReference = sourceLine.jsonLine[this.options.uniqueKey];
    const indexPath = this.fileHierarchicalManager.createDirectoryStructure(indexReference);
    fs.writeFileSync(indexPath, '.', 'utf-8');
  }
}
