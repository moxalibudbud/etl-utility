import { ReadStream } from 'fs';
import { ReadLineBase, ShouldInitiateInterface } from './read-line-base';
import { Readable } from 'stream';
// import { createBlobClient } from '@etl/azure-blob';

export class BlobReader extends ReadLineBase implements ShouldInitiateInterface {
  constructor(url: string) {
    super(url);
  }

  async getReadStream(): Promise<ReadStream> {
    // const blobClient = await createBlobClient(this.url);
    // const { readableStreamBody } = await blobClient.download(0);
    // return readableStreamBody as ReadStream;
    const dummyStream: unknown = '';
    return dummyStream as ReadStream;
  }

  // async readlineInterfacePromise(onLineHandler: any, onCloseHandler: any, onErrorHandler: any): Promise<any> {
  //   const readStream = await this.getReadStream();
  //   this.setInterface(readStream);
  //   return this.readlinePromise(onLineHandler, onCloseHandler, onErrorHandler);
  // }

  async initiateInterface(): Promise<void> {
    const readStream = await this.getReadStream();
    this.setInterface(readStream);
  }
}
