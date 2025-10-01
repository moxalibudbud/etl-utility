import { FlatFileBaseLazy, FlatFileBaseLazyMethods, FlatFileBaseLazyOptions, JSONOutput } from './flat-file-base-lazy';
import { SourceLine } from '../line-data';
import { LineOutputOptions } from '../line-data/line-output';
export declare class JSONGenerator extends FlatFileBaseLazy implements FlatFileBaseLazyMethods, JSONOutput {
    options: FlatFileBaseLazyOptions & LineOutputOptions;
    rowReferences: Set<string | number>;
    private rootData;
    private arrayBuckets;
    constructor(options: FlatFileBaseLazyOptions & LineOutputOptions);
    setFilename(line: SourceLine): void;
    pushFooter(): void;
    pushHeader(line: SourceLine): void;
    private parseRootPath;
    private parseArrayPath;
    buildRow(line: SourceLine): string;
    buildJson(line: SourceLine): void;
    isRowExist({ jsonLine }: SourceLine): boolean | undefined;
    trackReference({ jsonLine }: SourceLine): void;
    push(sourceLine: SourceLine): void;
    buildFinalJSON(): {
        [x: string]: any;
    };
    pushFinalJSON(): Promise<void>;
}
