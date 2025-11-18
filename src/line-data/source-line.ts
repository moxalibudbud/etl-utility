import { LineSourceBase, LineSourceBaseOptions } from './line-source-base';
import { DEFAULT_OPTIONS } from './source-line-base';
import { mapFields, lineDataToJSON, validateLine, mapWithDefault } from '../utils';
import { JSONObject } from '../types';

export class SourceLine extends LineSourceBase {
  line: string[];
  separator: string;
  columns: string[];
  jsonLine: JSONObject;
  options: LineSourceBaseOptions;

  constructor(line: string, options: LineSourceBaseOptions & { currentLineNumber: number }) {
    super();

    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.currentLineNumber = options.currentLineNumber;
    this.separator = options.separator;
    this.columns = options.columns;
    this.line = line.split(this.separator).map((value) => value.replace(/^"|"$/g, ''));
    this.jsonLine = this.toJSON();
  }

  toJSON(): JSONObject {
    if (this.options?.toJSON) {
      return this.options.toJSON(this.line);
    }
    return lineDataToJSON(this.options.columns, this.line);
  }

  validate() {
    const validationErrors = validateLine({
      line: this.line,
      columns: this.columns,
      mandatoryFields: this.options.mandatoryFields,
      lineData: this.jsonLine,
      currentLineNumber: this.currentLineNumber,
    });

    if (validationErrors.length) {
      this.errors.push(...validationErrors);
    }
  }

  get isValid(): boolean {
    return !this.errors.length;
  }

  get error(): string {
    return this.errors.toString();
  }

  get output() {
    return mapWithDefault(this.jsonLine || {}, this.options.outputMappings);
  }

  get isHeader(): boolean {
    if (this.options.withHeader) return this.currentLineNumber === 1;

    return false;
  }

  get identifiers() {
    if (this.options?.identifierMappings) {
      return mapFields(this.jsonLine || {}, this.options.identifierMappings);
    }

    return this.jsonLine;
  }
}
