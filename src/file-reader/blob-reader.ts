import { ReadStream } from 'fs';
import { serviceClient } from '@altavant/azure-blob';
import { ReadLineBase, ShouldInitiateInterface } from './read-line-base';

export class BlobReader extends ReadLineBase implements ShouldInitiateInterface {
  constructor(url: string) {
    super(url);
  }

  async getReadStream(): Promise<ReadStream> {
    const [accountName, accountKey] = [
      process.env.AZURE_BLOB_STORAGE_ACCOUNT_NAME as string,
      process.env.AZURE_BLOB_STORAGE_ACCOUNT_KEY as string,
    ];
    const client = serviceClient(accountName, accountKey);
    const blobClient = await client.blobClient(this.url);
    const { readableStreamBody } = await blobClient.download(0);
    return readableStreamBody as ReadStream;
  }

  async initiateInterface(): Promise<void> {
    const readStream = await this.getReadStream();
    this.setInterface(readStream);
  }
}
