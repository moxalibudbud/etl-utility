import fs, { ReadStream } from 'fs';
import { ReadLineBase, ReadlineInterfacePromise, ShouldInitiateInterface } from './read-line-base';

export class FileReader extends ReadLineBase implements ShouldInitiateInterface {
  constructor(filepath: string) {
    super(filepath);
  }

  getReadStream(): ReadStream {
    const exists = fs.existsSync(this.filepath);

    if (!exists) throw new Error(`File ${this.filepath} doesn't exist`);

    return fs.createReadStream(this.filepath);
  }

  // readlineInterfacePromise(onLineHandler: any, onCloseHandler: any, onErrorHandler: any): Promise<any> {
  //   const readStream = this.getReadStream();
  //   this.setInterface(readStream);
  //   return this.readlinePromise(onLineHandler, onCloseHandler, onErrorHandler);
  // }

  initiateInterface(): void {
    const readStream = this.getReadStream();
    this.setInterface(readStream);
    this.cleanUpPreviousListeners();
  }
}
