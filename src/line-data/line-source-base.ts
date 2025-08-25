import { JSONObject } from '../types';

type Rule = {
  field: string; // the new field to add (e.g. 'store')
  expression: string; // string expression using existing fields
};

export type LineSourceBaseOptions = {
  columns: string[];
  mandatoryFields: string[];
  identifierMappings: JSONObject;
  outputMappings: JSONObject;
  separator: string;
  withHeader: boolean;
  toJSON?: (line: string[]) => any;
  customValues?: Rule[];
};

export const DEFAULT_OPTIONS = {
  identifierMappings: {},
  outputMappings: {},
  separator: ';',
};

export abstract class LineSourceBase {
  abstract line: string[];
  abstract jsonLine?: JSONObject;
  abstract validate(): void;
  abstract get isValid(): boolean;
  abstract get error(): string;
  abstract get isHeader(): boolean;

  currentLineNumber: number = 1;
  errors: string[] = [];
}
