import { SourceLine } from '../line-data';

export type NestedRecord = {
  [key: string]: string | number | boolean | NestedRecord | NestedRecord[];
};

export type JSONObject = Record<string, any>;

export enum ETLType {
  COUNT_FILE = 'count-files',
  ITEM_MASTER = 'item-master',
  SOH = 'soh',
}

export type ETLResult = {
  valid: boolean;
  withErrors: boolean;
  totalErrors: number;
  localOutputFile: string;
  localOutputFilename: string;
  localErrorReportFile: string;
  localErrorReportFilename: string;
  metadata?: JSONObject | string;
};

export type FlatFileBaseLazyOptions = {
  path?: string;
  metadata?: Record<string, any>;
};

export interface FlatFileBaseLazyMethods {
  push(line: SourceLine): any;
  setFilename(line: SourceLine): any;
  pushFooter(): void;
}

export interface JSONOutput {
  buildFinalJSON(): void;
  pushFinalJSON(): void;
}

export interface FlatFileBaseMethods {
  push(...args: any[]): any;
}
