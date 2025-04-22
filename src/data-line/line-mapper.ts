import { LineBase, LineBaseOptions, LineObject } from './line-base';
// import * as utils from '../util/gold-onhand-utils';
import { validateLine } from '../util/line-validator';
import { mapFields } from '../utils/map';

export class LineMapper extends LineBase {
  line: string[];
  // separator: string = utils.SEPARATOR;
  separator: string;
  // columns: string[] = utils.COLUMNS;
  columns: string[]
  jsonLine?: LineObject;
  options: LineBaseOptions;

  constructor(line: string, options: LineBaseOptions) {
    super();
    this.options = options;

    this.currentLineNumber = options.currentLineNumber;
    this.separator = options?.separator || ';';
    this.columns = options.columns || [];

    this.line = line.split(this.separator).map((value) => value.replace(/^"|"$/g, ''));

    // TODO: We can move toJSON as a method in this class. And ask client to pass a config/rules how to convert this.line into object.
    this.jsonLine = options.toJSON(this.line);
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
    // TODO: We can move mapData as a method in this class. And ask client to pass a config/rules how to map the data;
    return utils.mapData(this.jsonLine);
  }

  get isHeader(): boolean {
    if (this.options.withHeader) return this.currentLineNumber === 1;

    return false;
  }

  get identifiers() {
    // TODO: We can move mapData as a method in this class. And ask client to pass a config/rules how to map the data;
    // return utils.mapIdentifiers(this.jsonLine);
    return mapFields(this.jsonLine, this.options?.identifierMappings || {})
  }
}
