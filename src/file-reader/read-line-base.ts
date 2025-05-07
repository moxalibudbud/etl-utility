import path from 'path';
import { ReadStream } from 'fs';
import readline, { ReadLine } from 'readline';

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
  readlineInterfacePromise(
    onLineHandler: ReadlineInterfaceLineHandler,
    onCloseHandler: ReadlineInterfaceCloseHandler,
    onErrorHandler: ReadlineInterfaceErrorHandler
  ): Promise<any> | void;
}

export interface ShouldInitiateInterface {
  initiateInterface(): void;
}

export abstract class ReadLineBase {
  readlineInterface?: ReadLine;
  source: string;

  constructor(source: string) {
    this.source = source;
  }

  get filepath(): string {
    return this.source;
  }

  get url(): string {
    return this.source;
  }

  get extension(): string {
    return path.extname(this.source).replace('.', '');
  }

  get directory(): string {
    return path.dirname(this.source);
  }

  get filename(): string {
    return path.basename(this.source);
  }

  /**
   * Clean up previous listeners if they exist to avoid memory leaks or duplicate event handling
   * @returns void
   */
  cleanUpPreviousListeners(): void {
    if (!this.readlineInterface) return;

    this.readlineInterface.removeAllListeners('line');
    this.readlineInterface.removeAllListeners('close');
    this.readlineInterface.removeAllListeners('error');
  }

  setInterface(readStream: ReadStream) {
    this.readlineInterface = readline.createInterface({
      input: readStream,
      crlfDelay: Infinity,
      terminal: false,
    });
  }

  readlinePromise(
    onLineHandler: ReadlineInterfaceLineHandler,
    onCloseHandler: ReadlineInterfaceCloseHandler,
    onErrorHandler: ReadlineInterfaceCloseHandler
  ): Promise<any> {
    this.cleanUpPreviousListeners();

    return new Promise((resolve, reject) => {
      try {
        this.readlineInterface?.on('line', onLineHandler);
        this.readlineInterface?.on('close', () => onCloseHandler(resolve));
        this.readlineInterface?.on('error', (e) => onErrorHandler(e));
      } catch (e) {
        reject(e);
      }
    });
  }
}
