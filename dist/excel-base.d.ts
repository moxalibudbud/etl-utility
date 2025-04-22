import * as ExcelJS from 'exceljs';
type ExcelBaseOptions = {
    filename: string;
    path?: string;
};
export interface ExcelBaseMethods {
    push(...args: any[]): any;
}
export declare class ExcelBase {
    writeStream: ExcelJS.stream.xlsx.WorkbookWriter;
    filename: string;
    filepath: string;
    worksheet: any;
    constructor(options: ExcelBaseOptions);
    end(): Promise<void>;
    delete(): Promise<unknown>;
}
export {};
