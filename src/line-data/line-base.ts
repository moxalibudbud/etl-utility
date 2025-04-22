import { JSONObject } from '../utils/types';

export type LineBaseOptions = {
  currentLineNumber: number;
  columns: string[];
  mandatoryFields: string[];
  identifierMappings: JSONObject;
  outputMappings: JSONObject;
  separator: string;
  withHeader: string;
  toJSON?: (line: string[]) => any;
};

export const DEFAULT_OPTIONS = {
  identifierMappings: {},
  outputMappings: {},
  separator: ';',
};

export abstract class LineBase {
  abstract line: string[];
  abstract jsonLine?: JSONObject;
  abstract validate(): void;
  abstract get isValid(): boolean;
  abstract get error(): string;
  abstract get isHeader(): boolean;

  currentLineNumber: number = 1;
  errors: string[] = [];
}
