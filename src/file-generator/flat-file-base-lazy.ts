import { createWriteStream, WriteStream, unlink, existsSync, chmod } from 'fs';
import { SourceLine } from '../line-data';

export type FlatFileBaseLazyOptions = {
  path?: string;
};

export interface FlatFileBaseLazyMethods {
  push(line: SourceLine): any;
  setFilename(line: SourceLine): any;
  pushFooter(): void;
}

export interface JSONOutput {
  buildFinalJSON(): void;
  pushFinalJSON(): void;
}

export class FlatFileBaseLazy {
  private _filename: string = '';
  path: string;
  writeStream?: WriteStream;

  constructor(options: FlatFileBaseLazyOptions) {
    this.path = options?.path ? options.path : '/var/tmp';
  }

  createStream(options: { flags?: 'a' | 'w' } = { flags: 'a' }) {
    this.writeStream = createWriteStream(this.filepath, options);

    const onOpen = () => {
      chmod(this.filepath, 0o777, (err) => {
        if (err) {
          console.error(`Failed to set permissions on ${this.filepath}:`, err);
        }
      });
      this.writeStream?.off('open', onOpen); // detach after first run
    };

    this.writeStream.on('open', onOpen);
  }

  createHeader(header: string) {
    if (this.writeStream) {
      this.writeStream.write(header);
    }
  }

  async end() {
    return new Promise((resolve) => {
      if (this.writeStream) {
        this.writeStream.end(() => {
          this.writeStream?.removeAllListeners();
          resolve({});
        });
      } else {
        resolve({});
      }
    });
  }

  async delete() {
    const removeFile = (resolve: Function) => {
      if (this.filename && existsSync(this.filepath)) {
        unlink(this.filepath, (e) => {
          resolve(e);
        });
      } else {
        resolve();
      }
    };

    return new Promise((resolve, reject) => {
      try {
        removeFile(resolve);
      } catch (e) {
        reject(e);
      }
    });
  }

  get filepath(): string {
    return `${this.path}/${this._filename}`;
  }

  get filename(): string | undefined {
    return this._filename;
  }

  set filename(filename: string) {
    this._filename = filename;
  }
}
