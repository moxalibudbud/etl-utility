import { PassThrough } from 'stream';
import { BlockBlobClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { FlatFileBaseLazy, FlatFileBaseLazyOptions } from './flat-file-base-lazy';

export type AzureBlobStreamWriterOptions = FlatFileBaseLazyOptions & {
  containerName: string;
  accountName?: string;
  accountKey?: string;
  blobPrefix?: string;
  bufferSize?: number;
  maxConcurrency?: number;
};

export class AzureBlobStreamWriter extends FlatFileBaseLazy {
  private readonly azureOptions: AzureBlobStreamWriterOptions;
  private uploadPromise?: Promise<any>;

  constructor(options: AzureBlobStreamWriterOptions) {
    super(options);
    this.azureOptions = options;
  }

  createStream(_options?: { flags?: 'a' | 'w' }): void {
    const pass = new PassThrough();
    this.writeStream = pass;

    this.uploadPromise = this._buildClient().uploadStream(
      pass,
      this.azureOptions.bufferSize ?? 4 * 1024 * 1024,
      this.azureOptions.maxConcurrency ?? 5,
    );
  }

  async end(): Promise<object> {
    return new Promise((resolve, reject) => {
      if (!this.writeStream) {
        resolve({});
        return;
      }
      this.writeStream.end(async () => {
        this.writeStream?.removeAllListeners();
        try {
          resolve((await this.uploadPromise) ?? {});
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  async delete(): Promise<void> {
    if (!this.filename) return;
    await this._buildClient().delete();
  }

  private _buildClient(): BlockBlobClient {
    const accountName = (this.azureOptions.accountName ??
      process.env.AZURE_BLOB_STORAGE_ACCOUNT_NAME) as string;
    const accountKey = (this.azureOptions.accountKey ??
      process.env.AZURE_BLOB_STORAGE_ACCOUNT_KEY) as string;
    const blobName = this.azureOptions.blobPrefix
      ? `${this.azureOptions.blobPrefix}/${this.filename}`
      : (this.filename as string);
    const url = `https://${accountName}.blob.core.windows.net/${this.azureOptions.containerName}/${blobName}`;
    return new BlockBlobClient(url, new StorageSharedKeyCredential(accountName, accountKey));
  }
}
