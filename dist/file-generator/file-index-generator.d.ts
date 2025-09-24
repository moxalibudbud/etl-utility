import { FlatFileBaseLazy, FlatFileBaseLazyMethods, FlatFileBaseLazyOptions } from './flat-file-base-lazy';
import { SourceLine } from '../line-data';
import { LineOutputOptions } from '../line-data/line-output';
type FileIndexGeneratorOptions = FlatFileBaseLazyOptions & Omit<LineOutputOptions, 'uniqueKey' | 'indexFile' | 'rowReferences'> & Required<Pick<LineOutputOptions, 'uniqueKey' | 'indexFile' | 'rowReferences'>>;
export declare class FileIndexGenerator extends FlatFileBaseLazy implements FlatFileBaseLazyMethods {
    options: FileIndexGeneratorOptions;
    rowReferences: Set<string | number>;
    constructor(options: FileIndexGeneratorOptions);
    setFilename(line: SourceLine): void;
    pushFooter(): void;
    trackReference({ jsonLine }: SourceLine): void;
    buildRow(line: SourceLine): string;
    isRowExist({ jsonLine }: SourceLine): boolean;
    push(sourceLine: SourceLine): void;
}
export {};
