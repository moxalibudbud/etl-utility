import { FlatFileBaseLazy, FlatFileBaseLazyMethods } from '../../../file-generator/flat-file-base-lazy';
import { ETL } from '../../../etl';
import { SourceLineBaseOptions } from '../../../line-data';
export type OctoplusLineOptions = SourceLineBaseOptions & {
    skuField: string;
};
type ETLOptions = {
    line: OctoplusLineOptions;
    filesource: {
        blobURL: string;
        file?: never;
    } | {
        file: string;
        blobURL?: never;
    };
    rejectOnInvalidRow?: boolean;
};
export declare class OctoplusOutfileETL extends ETL {
    constructor(args: ETLOptions, outputFileWriter: FlatFileBaseLazy & FlatFileBaseLazyMethods);
    onLineHandler(chunk: string): void;
}
export {};
