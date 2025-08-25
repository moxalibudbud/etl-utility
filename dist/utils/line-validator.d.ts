import { JSONObject } from '../types';
type Props = {
    line: string[];
    columns: string[];
    mandatoryFields: string[];
    lineData: JSONObject;
    currentLineNumber: number;
    barcode?: string;
    isHeader?: boolean;
};
export declare const errorPrefix: (currentLineNumber: number | string) => string;
export declare function validateLine({ line, columns, mandatoryFields, lineData, currentLineNumber, barcode, isHeader, }: Props): string[];
export {};
