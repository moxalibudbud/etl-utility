export interface LineObject {
  [key: string]: string;
}

export type LineBaseOptions = {
  currentLineNumber: number;
  columns: string[];
  mandatoryFields: string[];
  identifierMappings?: Record<string, string>;
  outputMappings: Record<string, string>;
  toJSON?: (line: string[]) => any;
  separator?: string;
  withHeader?: string;
};

export abstract class LineBase {
  abstract line: string[];
  abstract jsonLine?: LineObject;
  abstract validate(): void;
  abstract get isValid(): boolean;
  abstract get error(): string;
  abstract get isHeader(): boolean;

  currentLineNumber: number = 1;
  errors: string[] = [];
}
