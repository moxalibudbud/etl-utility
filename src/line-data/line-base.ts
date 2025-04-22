import { JSONObject } from '../utils/types';

export type LineBaseOptions = {
  currentLineNumber: number;
  columns: string[];
  mandatoryFields: string[];
  identifierMappings?: JSONObject;
  outputMappings: JSONObject;
  toJSON?: (line: string[]) => any;
  separator?: string;
  withHeader?: string;
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
