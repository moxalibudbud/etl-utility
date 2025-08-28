import { ErrorReport } from '../file-generator/error-report';
import { ReadLineInterface } from '../file-reader/readline-interface-factory';
import { ETLResult, JSONObject } from '../types';
import { JSONSourceLine, LineSourceBaseOptions } from '../line-data';
import { FlatFileBaseLazy, FlatFileBaseLazyMethods } from '../file-generator/flat-file-base-lazy';
type ETLOptions = {
    line: LineSourceBaseOptions;
    json: JSONObject[];
    errorFilename: string;
    rejectOnInvalidRow?: boolean;
};
export declare class JsonETL {
    outputFileWriter: FlatFileBaseLazy & FlatFileBaseLazyMethods;
    errorReportWriter: ErrorReport;
    lineReader?: ReadLineInterface;
    fileSource?: string;
    json: never[];
    valid: boolean;
    lineIndex: number;
    sampleLineData?: JSONObject;
    identifiers?: JSONObject;
    options: ETLOptions;
    constructor(args: ETLOptions, outputFileWriter: FlatFileBaseLazy & FlatFileBaseLazyMethods);
    initiateErrorReportWriter(): ErrorReport;
    onLineHandler(json: JSONObject): void;
    populate(line: JSONSourceLine): void;
    setSampleLineData(args: JSONObject): void;
    setIdentifier(identifiers: JSONObject): void;
    processLines(): Promise<void>;
    forceCleanUp(): Promise<void>;
    cleanUp(): Promise<void>;
    validateFinalResult(): void;
    getResult(): ETLResult;
    process(): Promise<ETLResult>;
}
export {};
