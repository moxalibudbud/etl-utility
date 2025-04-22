import { WriteStream } from 'fs';
type FlatFileBaseOptions = {
    filename: string;
    path?: string;
};
export interface FlatFileBaseMethods {
    push(...args: any[]): any;
}
export declare class FlatFileBase {
    writeStream: WriteStream;
    filename: string;
    filepath: string;
    constructor(options: FlatFileBaseOptions);
    end(): Promise<unknown>;
    delete(): Promise<unknown>;
}
export {};
