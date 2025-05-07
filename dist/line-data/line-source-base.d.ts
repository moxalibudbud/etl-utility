import { JSONObject } from '../types';
export type LineSourceBaseOptions = {
    columns: string[];
    mandatoryFields: string[];
    identifierMappings: JSONObject;
    outputMappings: JSONObject;
    separator: string;
    withHeader: boolean;
    toJSON?: (line: string[]) => any;
};
export declare const DEFAULT_OPTIONS: {
    identifierMappings: {};
    outputMappings: {};
    separator: string;
};
export declare abstract class LineSourceBase {
    abstract line: string[];
    abstract jsonLine?: JSONObject;
    abstract validate(): void;
    abstract get isValid(): boolean;
    abstract get error(): string;
    abstract get isHeader(): boolean;
    currentLineNumber: number;
    errors: string[];
}
