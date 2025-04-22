export interface LineObject {
  [key: string]: string;
}

export type LineBaseOptions = {
  currentLineNumber: number;
  columns: string[];
  mandatoryFields: string[];
  toJSON: (line: string[], options?: Record<string, any>) => any;
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
