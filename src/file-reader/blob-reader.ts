import { ReadStream } from 'fs';
import { ReadLineBase, ShouldInitiateInterface } from './read-line-base';
import { createBlobClient } from 'azure-blob-wrapper';

export class BlobReader extends ReadLineBase implements ShouldInitiateInterface {
  constructor(url: string) {
    super(url);
  }

  async getReadStream(): Promise<ReadStream> {
    const auth = {
      accountName: process.env.AZURE_BLOB_STORAGE_ACCOUNT_NAME as string,
      accountKey: process.env.AZURE_BLOB_STORAGE_ACCOUNT_KEY as string,
    };

    const blobClient = createBlobClient(this.url, auth);
    const { readableStreamBody } = await blobClient.download(0);
    return readableStreamBody as ReadStream;
  }

  async initiateInterface(): Promise<void> {
    const readStream = await this.getReadStream();
    this.setInterface(readStream);
  }
}
