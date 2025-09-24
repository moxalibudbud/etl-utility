import { FlatFileBaseLazy, FlatFileBaseLazyMethods, FlatFileBaseLazyOptions } from './flat-file-base-lazy';
import { SourceLine } from '../line-data';
import { LineOutputOptions } from '../line-data/line-output';
type PushIfExistGeneratorOptions = FlatFileBaseLazyOptions & Omit<LineOutputOptions, 'uniqueKey'> & Required<Pick<LineOutputOptions, 'uniqueKey'>> & {
    indexFile?: string;
    rowReferences: Set<string | number>;
};
export declare class PushIfExistGenerator extends FlatFileBaseLazy implements FlatFileBaseLazyMethods {
    options: PushIfExistGeneratorOptions;
    rowReferences: Set<string | number>;
    constructor(options: PushIfExistGeneratorOptions);
    setFilename(line: SourceLine): void;
    pushFooter(): void;
    pushHeader(line: SourceLine): void;
    buildRow(line: SourceLine): string;
    isRowExist({ jsonLine }: SourceLine): boolean;
    push(sourceLine: SourceLine): void;
}
export {};
