import { FlatFileBase, FlatFileBaseMethods } from './flat-file-base';
type ErrorReportOptions = {
    filename: string;
    path?: string;
};
export declare class ErrorReport extends FlatFileBase implements FlatFileBaseMethods {
    invalidRows: number;
    constructor(options: ErrorReportOptions);
    push(line: string): void;
    incrementInvalidRowsCount(): void;
}
export {};
