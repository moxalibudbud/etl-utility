import { LineSourceBase, LineSourceBaseOptions } from './line-source-base';
import { JSONObject } from '../types';
export declare class SourceLine extends LineSourceBase {
    line: string[];
    separator: string;
    columns: string[];
    jsonLine: JSONObject;
    options: LineSourceBaseOptions;
    constructor(line: string, options: LineSourceBaseOptions & {
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
