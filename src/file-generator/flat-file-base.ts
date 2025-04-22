import { createWriteStream, WriteStream, unlink } from 'fs';

type FlatFileBaseOptions = {
  filename: string;
  path?: string;
};

export interface FlatFileBaseMethods {
  push(...args: any[]): any;
}

export class FlatFileBase {
  writeStream: WriteStream;
  filename: string;
  filepath: string;

  constructor(options: FlatFileBaseOptions) {
    const path = options?.path ? options.path : '/var/tmp';

    this.filename = options.filename;
    this.filepath = `${path}/${this.filename}`;
    this.writeStream = createWriteStream(this.filepath);
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
      unlink(this.filepath, (e) => {
        resolve(e);
      });
    };

    return new Promise((resolve, reject) => {
      try {
        removeFile(resolve);
      } catch (e) {
        reject(e);
      }
    });
  }
}
