import { LineBase, LineBaseOptions, LineObject } from './line-base';
import { mapFields, lineDataToJSON, validateLine } from '../utils';

export class LineMapper extends LineBase {
  line: string[];
  // separator: string = utils.SEPARATOR;
  separator: string;
  // columns: string[] = utils.COLUMNS;
  columns: string[];
  jsonLine?: LineObject;
  options: LineBaseOptions;

  constructor(line: string, options: LineBaseOptions) {
    super();
    this.options = options;

    this.currentLineNumber = options.currentLineNumber;
    this.separator = options?.separator || ';';
    this.columns = options.columns || [];

    this.line = line.split(this.separator).map((value) => value.replace(/^"|"$/g, ''));
    this.jsonLine = options?.toJSON?.(this.line) ?? this.toJSON();
  }

  toJSON(): LineObject {
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
