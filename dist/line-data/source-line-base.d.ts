import { JSONObject } from '../types';
export type SourceLineBaseOptions = {
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
export declare abstract class SourceLineBase {
    line: string[];
    separator: string;
    columns: string[];
    jsonLine: JSONObject;
    options: SourceLineBaseOptions;
    currentLineNumber: number;
    errors: string[];
    constructor(line: string, options: SourceLineBaseOptions & {
        currentLineNumber: number;
    });
    toJSON(): JSONObject;
    validate(): void;
    get isValid(): boolean;
    get error(): string;
    get output(): {
        [x: string]: any;
    };
    get isHeader(): boolean;
    get identifiers(): JSONObject;
}
