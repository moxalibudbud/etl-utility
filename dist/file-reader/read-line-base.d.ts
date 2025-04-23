import { ReadStream } from 'fs';
import { ReadLine } from 'readline';
export interface ReadlineInterfaceLineHandler {
    (...args: any): void;
}
export interface ReadlineInterfaceCloseHandler {
    (resolve: Function): void;
}
export interface ReadlineInterfaceErrorHandler {
    (error: any): void;
}
export interface ReadlineInterfacePromise {
    readlineInterfacePromise(onLineHandler: ReadlineInterfaceLineHandler, onCloseHandler: ReadlineInterfaceCloseHandler, onErrorHandler: ReadlineInterfaceErrorHandler): Promise<any> | void;
}
export interface ShouldInitiateInterface {
    initiateInterface(): void;
}
export declare abstract class ReadLineBase {
    readlineInterface?: ReadLine;
    source: string;
    constructor(source: string);
    get filepath(): string;
    get url(): string;
    get extension(): string;
    get directory(): string;
    get filename(): string;
    cleanUpPreviousListeners(): void;
    setInterface(readStream: ReadStream): void;
    readlinePromise(onLineHandler: ReadlineInterfaceLineHandler, onCloseHandler: ReadlineInterfaceCloseHandler, onErrorHandler: ReadlineInterfaceCloseHandler): Promise<any>;
}
