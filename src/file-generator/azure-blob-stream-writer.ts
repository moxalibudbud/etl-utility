import { PassThrough } from 'stream';
import { BlobUploadCommonResponse, BlockBlobClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { LineOutputOptions, SourceLine } from 'src/line-data';
import { buildLineFromLineKeys, setFilename } from '../utils';
import { replaceWithFunction } from '../utils/replace-with-function';
import { replaceWithMap } from '../utils/replace-with-map';
import { FlatFileBaseLazyMethods, FlatFileBaseLazyOptions } from '../types';
import { FlatFileBaseLazy } from '../file-generator';
const DEFAULT_BUFFER_SIZE = 4 * 1024 * 1024; // 4MB
const DEFAULT_CONCURRENCY = 5;

export type AzureBlobStreamWriterOptions = FlatFileBaseLazyOptions &
  LineOutputOptions & {
    containerName: string;
    connectionString?: string;
    blobPrefix?: string;
    bufferSize?: number;
    maxConcurrency?: number;
  };

export class AzureBlobStreamWriter extends FlatFileBaseLazy implements FlatFileBaseLazyMethods {
  private readonly options: AzureBlobStreamWriterOptions;
  private uploadPromise?: Promise<BlobUploadCommonResponse>;
  private uploadError?: Error;
  rowReferences = new Set<number | string>();

  constructor(options: AzureBlobStreamWriterOptions) {
    super(options);
    this.options = options;
  }

  createStream(_options?: { flags?: 'a' | 'w' }): void {
    const pass = new PassThrough();
    const bufferSize = this.options.bufferSize ?? DEFAULT_BUFFER_SIZE;
    const maxConcurrency = this.options.maxConcurrency ?? DEFAULT_CONCURRENCY;
    this.writeStream = pass;

    this.uploadPromise = this._buildClient()
      .uploadStream(pass, bufferSize, maxConcurrency)
      .catch((err) => {
        this.uploadError = err;
        pass.destroy(err); // makes future writes fail loudly
        throw err; // preserved for end()
      });
  }

  private _buildClient(): BlockBlobClient {
    const connectionString = (this.options.connectionString ?? process.env.AZURE_BLOB_CONNECTION_STRING) || '';
    const blobName = this.filename || `${Date.now()}_filename.txt`;
    return new BlockBlobClient(connectionString, this.options.containerName, blobName);
  }

  async delete(): Promise<void> {
    if (!this.filename) return;
    await this._buildClient().deleteIfExists();
  }

  setFilename(line: SourceLine) {
    this.filename = setFilename(this.options.filename, { line, metadata: this.metadata });
  }

  pushHeader(line: SourceLine) {
    if (!this.options.header) return;

    const metadata = { ...line.allData, metadata: this.options.metadata };
    const headerRow = replaceWithFunction(this.options.header, metadata);

    // For headers to add new row
    this.createHeader(headerRow);
  }

  pushFooter() {
    if (this.options?.footer) {
      this.writeStream?.write(this.options?.footer);
    }
  }

  buildRow(line: SourceLine) {
    let row = '';

    if (typeof this.options.template === 'string') {
      const metadata = { ...line.allData, metadata: this.options.metadata || {} };
      row = replaceWithFunction(replaceWithMap(this.options.template, line.jsonLine), metadata);
    } else {
      const { separator } = this.options;
      row = buildLineFromLineKeys(line.output, { separator });
    }

    // Only append new line for incoming row.
    // This will prevent an empty row in the file
    return line.isHeader ? row : '\n' + row;
  }

  isRowExist({ jsonLine }: SourceLine) {
    if (!this.options.uniqueKey) return false;
    return !!this.rowReferences.has(jsonLine[this.options.uniqueKey]);
  }

  trackReference({ jsonLine }: SourceLine) {
    if (this.options.uniqueKey) {
      const key = jsonLine[this.options.uniqueKey];
      this.rowReferences.add(key);
    }
  }

  push(sourceLine: SourceLine) {
    if (this.uploadError) throw this.uploadError;
    const isRowExist = this.isRowExist(sourceLine);

    if (!this.filename) {
      this.setFilename(sourceLine);
    }
    if (!this.writeStream) {
      this.createStream();
      this.pushHeader(sourceLine);
    }

    if (isRowExist) return;

    const row = this.buildRow(sourceLine);
    this.writeStream?.write(row);
    this.trackReference(sourceLine);
    console.log('on push event: ', sourceLine.currentLineNumber);
  }
}
