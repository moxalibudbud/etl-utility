import { BlobReader } from './blob-reader';
import { FileReader } from './file-reader';
export type ReadLineInterface = BlobReader | FileReader;
export declare enum ReadLineInterfaceType {
    Blob = "blob",
    File = "file"
}
export declare function readLineInterface(source: string, type: ReadLineInterfaceType): BlobReader | FileReader;
