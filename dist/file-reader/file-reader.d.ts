import { ReadStream } from 'fs';
import { ReadLineBase, ShouldInitiateInterface } from './read-line-base';
export declare class FileReader extends ReadLineBase implements ShouldInitiateInterface {
    constructor(filepath: string);
    getReadStream(): ReadStream;
    initiateInterface(): void;
}
