import fspromises from 'fs/promises';
import { FlatFileBaseLazyMethods, FlatFileBaseLazyOptions, JSONOutput } from '../types';
import { FlatFileBaseLazy } from './flat-file-base-lazy';
import { SourceLine } from '../line-data';
import { LineOutputOptions } from '../line-data/line-output';
import { buildLineFromLineKeys } from '../utils';
import { replaceWithFunction } from '../utils/replace-with-function';
import { replaceWithMap } from '../utils/replace-with-map';

// Parsed path information
interface ParsedPath {
  type: 'root' | 'array';
  rootKey?: string;
  arrayKey?: string;
  arrayField?: string;
}

interface ParsedArrayPath {
  type: 'array';
  arrayKey: string;
  arrayField: string;
}

export class JSONGenerator extends FlatFileBaseLazy implements FlatFileBaseLazyMethods, JSONOutput {
  options: FlatFileBaseLazyOptions & LineOutputOptions;
  rowReferences = new Set<number | string>();
  private rootData: Record<string, any> = {};
  private arrayBuckets: Map<string, any[]> = new Map();

  constructor(options: FlatFileBaseLazyOptions & LineOutputOptions) {
    super(options);

    this.options = options;
  }

  setFilename(line: SourceLine) {
    const { filename } = this.options;

    if (typeof filename === 'object' && filename !== null) {
      this.filename = replaceWithFunction(replaceWithMap(filename.template, line.jsonLine));
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
    const header = replaceWithFunction(this.options.header || '', line.allData);
    // const header = replaceWithMap(this.options.header as string, line.jsonLine);
    this.rootData = { ...JSON.parse(header) };
  }

  private parseRootPath(path: string): ParsedPath {
    // Check if it's a root path: "root.fieldName"
    const rootMatch = path.match(/^root\.(\w+)$/);
    if (rootMatch) {
      return {
        type: 'root',
        rootKey: rootMatch[1],
      };
    }

    return {
      type: 'root',
      rootKey: 'id',
    };
  }

  private parseArrayPath(path: string): ParsedArrayPath {
    // Check if it's an array path: "arrayName[].fieldName"
    const arrayMatch = path.match(/^(\w+)\[\]\.(\w+)$/);
    if (arrayMatch) {
      return {
        type: 'array',
        arrayKey: arrayMatch[1],
        arrayField: arrayMatch[2],
      };
    }

    return {
      type: 'array',
      arrayKey: 'lines',
      arrayField: 'id',
    };
  }

  buildJson(line: SourceLine) {
    const arrayKey = this.options?.arrayField || 'lines';

    if (!this.arrayBuckets.has(arrayKey)) {
      this.arrayBuckets.set(arrayKey, []);
    }

    const bucket = this.arrayBuckets.get(arrayKey)!;
    const metadata = { ...line.allData, metadata: this.options.metadata || {} };
    let item = replaceWithFunction(replaceWithMap(this.options.template as string, line.jsonLine), metadata);

    bucket.push(JSON.parse(item));
  }

  isRowExist({ jsonLine }: SourceLine) {
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
    if (!this.filename) {
      this.setFilename(sourceLine);
    }

    if (!Object.keys(this.rootData).length) {
      this.pushHeader(sourceLine);
    }

    if (this.isRowExist(sourceLine)) return;

    this.buildJson(sourceLine);
  }

  buildFinalJSON() {
    const finalJSON = { ...this.rootData };
    const arrayKey = this.options.arrayField || 'lines';
    finalJSON[arrayKey] = this.arrayBuckets.get(arrayKey) || [];

    return finalJSON;
  }

  async pushFinalJSON() {
    const finalJSON = this.buildFinalJSON();

    // TODO: For now let's write a file in /var/tmp
    await fspromises.writeFile(this.filepath as string, JSON.stringify(finalJSON, null, 2), 'utf-8');
  }
}
