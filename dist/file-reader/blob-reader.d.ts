import { ReadStream } from 'fs';
import { ReadLineBase, ShouldInitiateInterface } from './read-line-base';
export declare class BlobReader extends ReadLineBase implements ShouldInitiateInterface {
    constructor(url: string);
    getReadStream(): Promise<ReadStream>;
    initiateInterface(): Promise<void>;
}
