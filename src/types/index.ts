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
