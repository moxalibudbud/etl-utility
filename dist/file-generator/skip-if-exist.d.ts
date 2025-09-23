import { FlatFileBaseLazy, FlatFileBaseLazyMethods, FlatFileBaseLazyOptions } from './flat-file-base-lazy';
import { SourceLine } from '../line-data';
import { LineOutputOptions } from '../line-data/line-output';
type SkipIfExistGeneratorOptions = FlatFileBaseLazyOptions & Omit<LineOutputOptions, 'uniqueKey'> & Required<Pick<LineOutputOptions, 'uniqueKey'>> & {
    indexFile?: string;
};
export declare class SkipIfExistGenerator extends FlatFileBaseLazy implements FlatFileBaseLazyMethods {
    options: SkipIfExistGeneratorOptions;
    rowReferences: Set<string | number>;
    fileHierarchicalManager?: any;
    constructor(options: SkipIfExistGeneratorOptions);
    loadIndex(): Set<string | number>;
    setFilename(line: SourceLine): void;
    pushFooter(): void;
    pushHeader(line: SourceLine): void;
    buildRow(line: SourceLine): string;
    isRowExist({ jsonLine }: SourceLine): boolean;
    push(sourceLine: SourceLine): void;
}
export {};
