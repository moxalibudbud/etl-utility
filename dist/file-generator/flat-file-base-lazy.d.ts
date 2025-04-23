import { WriteStream } from 'fs';
import { SourceLine } from '../line-data';
export type FlatFileBaseLazyOptions = {
    path?: string;
};
export interface FlatFileBaseLazyMethods {
    push(SourceLine: SourceLine): any;
    setFilename(SourceLine: SourceLine): any;
    pushFooter(): void;
}
export declare class FlatFileBaseLazy {
    private _filename;
    path: string;
    writeStream?: WriteStream;
    constructor(options: FlatFileBaseLazyOptions);
    createStream(): void;
    createHeader(header: string): void;
    end(): Promise<unknown>;
    delete(): Promise<unknown>;
    get filepath(): string;
    get filename(): string | undefined;
    set filename(filename: string);
}
