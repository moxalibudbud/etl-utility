import { PassThrough } from 'stream';
import { Upload } from '@aws-sdk/lib-storage';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { FlatFileBaseLazyOptions } from '../types';
import { FlatFileBaseLazy } from './flat-file-base-lazy';

export type S3StreamWriterOptions = FlatFileBaseLazyOptions & {
  bucket: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  keyPrefix?: string;
};

export class S3StreamWriter extends FlatFileBaseLazy {
  private readonly s3Options: S3StreamWriterOptions;
  private uploadPromise?: Promise<any>;

  constructor(options: S3StreamWriterOptions) {
    super(options);
    this.s3Options = options;
  }

  createStream(_options?: { flags?: 'a' | 'w' }): void {
    const pass = new PassThrough();
    this.writeStream = pass;

    const key = this.s3Options.keyPrefix ? `${this.s3Options.keyPrefix}/${this.filename}` : (this.filename as string);

    const upload = new Upload({
      client: this._buildClient(),
      params: { Bucket: this.s3Options.bucket, Key: key, Body: pass },
    });

    this.uploadPromise = upload.done();
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
    const key = this.s3Options.keyPrefix ? `${this.s3Options.keyPrefix}/${this.filename}` : (this.filename as string);
    await this._buildClient().send(new DeleteObjectCommand({ Bucket: this.s3Options.bucket, Key: key }));
  }

  private _buildClient(): S3Client {
    return new S3Client({
      region: this.s3Options.region ?? process.env.AWS_REGION,
      credentials: {
        accessKeyId: (this.s3Options.accessKeyId ?? process.env.AWS_ACCESS_KEY_ID) as string,
        secretAccessKey: (this.s3Options.secretAccessKey ?? process.env.AWS_SECRET_ACCESS_KEY) as string,
      },
    });
  }
}
