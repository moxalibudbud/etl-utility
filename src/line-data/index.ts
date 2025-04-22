import { LineBase, LineBaseOptions, DEFAULT_OPTIONS } from './line-base';
import { mapFields, lineDataToJSON, validateLine } from '../utils';
import { JSONObject } from '../utils/types';

export class LineData extends LineBase {
  line: string[];
  separator: string;
  columns: string[];
  jsonLine: JSONObject;
  options: LineBaseOptions;

  constructor(line: string, options: LineBaseOptions) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };

    this.currentLineNumber = options.currentLineNumber;
    this.separator = options?.separator || ';';
    this.columns = options.columns || [];

    this.line = line.split(this.separator).map((value) => value.replace(/^"|"$/g, ''));
    this.jsonLine = options?.toJSON?.(this.line) ?? this.toJSON();
  }

  toJSON(): JSONObject {
    const lineData = lineDataToJSON(this.options.columns, this.line);
    return lineData;
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
    return mapFields(this.jsonLine || {}, this.options.outputMappings);
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
