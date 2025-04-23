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
  destinationContainer: string;
  etlType?: ETLType; // Deprecated. But kept for backward compatibility especially for the old ETL process
  metadata?: JSONObject | string;
};
