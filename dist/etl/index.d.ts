import { ErrorReport } from '../file-generator/error-report';
import { ReadLineInterface } from '../file-reader/readline-interface-factory';
import { ETLResult, JSONObject } from '../types';
import { SourceLine, LineSourceBaseOptions } from '../line-data';
import { FlatFileBaseLazy, FlatFileBaseLazyMethods } from '../file-generator/flat-file-base-lazy';
type ETLOptions = {
    line: LineSourceBaseOptions;
    etl: {
        blobURL: string;
        file?: never;
    } | {
        file: string;
        blobURL?: never;
    };
    destinationContainer: string;
    etlType: string;
};
export declare class ETL {
    outputFileWriter: FlatFileBaseLazy & FlatFileBaseLazyMethods;
    errorReportWriter: ErrorReport;
    lineReader: ReadLineInterface;
    fileSource: string;
    valid: boolean;
    lineIndex: number;
    sampleLineData?: JSONObject;
    identifiers?: JSONObject;
    options: ETLOptions;
    constructor(args: ETLOptions, outputFileWriter: FlatFileBaseLazy & FlatFileBaseLazyMethods);
    initiateReadlineInterface(blobUrl?: string | undefined): import("../file-reader/blob-reader").BlobReader | import("../file-reader/file-reader").FileReader;
    initiateErrorReportWriter(): ErrorReport;
    onLineHandler(chunk: string): void;
    onCloseHandler(resolve: Function): void;
    populate(line: SourceLine): void;
    setSampleLineData(args: JSONObject): void;
    setIdentifier(identifiers: JSONObject): void;
    processLines(): Promise<unknown>;
    cleanUp(): Promise<void>;
    validateFinalResult(): void;
    getResult(): ETLResult;
    process(): Promise<ETLResult>;
}
export {};
