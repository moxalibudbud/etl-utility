import * as ExcelJS from 'exceljs';
export type ExcelBaseLazyOptions = {
    path?: string;
};
export interface ExcelBaseLazyMethods {
    push(...args: any[]): any;
    setFilename(store: string): any;
}
export declare class ExcelBaseLazy {
    private _filename;
    path: string;
    writeStream?: ExcelJS.stream.xlsx.WorkbookWriter;
    worksheet?: any;
    constructor(options: ExcelBaseLazyOptions);
    createStream(): void;
    createWorksheet(): void;
    createHeader(header: string[]): void;
    end(): Promise<void>;
    delete(): Promise<unknown>;
    get filepath(): string;
    get filename(): string | undefined;
    set filename(filename: string);
}
