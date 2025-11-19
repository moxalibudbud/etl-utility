import { FlatFileBaseLazy, FlatFileBaseLazyMethods, FlatFileBaseLazyOptions } from './flat-file-base-lazy';
import { SourceLine } from '../line-data';
import { LineOutputOptions } from '../line-data/line-output';
export declare class DefaultGenerator extends FlatFileBaseLazy implements FlatFileBaseLazyMethods {
    options: FlatFileBaseLazyOptions & LineOutputOptions;
    rowReferences: Set<string | number>;
    constructor(options: FlatFileBaseLazyOptions & LineOutputOptions);
    setFilename(line: SourceLine): void;
    pushFooter(): void;
    pushHeader(line: SourceLine): void;
    buildRow(line: SourceLine): string;
    isRowExist({ jsonLine }: SourceLine): boolean | undefined;
    accumulateNumberValue({ jsonLine }: SourceLine): boolean | undefined;
    trackReference({ jsonLine }: SourceLine): void;
    push(sourceLine: SourceLine): void;
}
