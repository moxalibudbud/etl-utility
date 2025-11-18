import { JSONObject } from '../types';

export type LineSourceBaseOptions = {
  columns: string[];
  mandatoryFields: string[];
  identifierMappings: JSONObject;
  outputMappings: JSONObject;
  separator: string;
  withHeader: boolean;
  toJSON?: (line: string[]) => any;
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
