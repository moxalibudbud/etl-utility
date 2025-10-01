import fspromises from 'fs/promises';
import {
  FlatFileBaseLazy,
  FlatFileBaseLazyMethods,
  FlatFileBaseLazyOptions,
  JSONFileBuilder,
} from './flat-file-base-lazy';
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

export class JSONGenerator extends FlatFileBaseLazy implements FlatFileBaseLazyMethods, JSONFileBuilder {
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
    const header = replaceWithMap(this.options.header as string, line.jsonLine);
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

  buildJson(line: SourceLine) {
    const arrayKey = this.options?.arrayField || 'lines';

    // Array data - accumulate items
    if (!this.arrayBuckets.has(arrayKey)) {
      this.arrayBuckets.set(arrayKey, []);
    }

    const bucket = this.arrayBuckets.get(arrayKey)!;

    // Find or create the current array item for this line
    if (!bucket[line.currentLineNumber]) {
      let item = replaceWithMap(this.options.template as string, line.jsonLine);
      item = replaceWithFunction(item);
      bucket[line.currentLineNumber] = JSON.parse(item);
    }
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

  async buildFinalJSON() {
    const finalJSON = { ...this.rootData };

    // Add all array buckets to the result
    this.arrayBuckets.forEach((items, key) => {
      // Filter out undefined items (from gaps in line numbers)
      finalJSON[key] = items.filter((item) => item !== undefined);
    });

    // Write to output file
    await fspromises.writeFile(this.filepath as string, JSON.stringify(finalJSON, null, 2), 'utf-8');
  }
}
