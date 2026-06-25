import { createWriteStream, unlink } from 'fs';
import * as ExcelJS from 'exceljs';

export type ExcelBaseLazyOptions = {
  path?: string;
};

export interface ExcelBaseLazyMethods {
  push(...args: any[]): any;
  setFilename(store: string): any;
}

export class ExcelBaseLazy {
  private _filename: string = '';
  path: string;
  writeStream?: ExcelJS.stream.xlsx.WorkbookWriter;
  worksheet?: any;

  constructor(options: ExcelBaseLazyOptions) {
    this.path = options?.path ? options.path : '/var/tmp';
  }

  createStream() {
    this.writeStream = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: createWriteStream(this.filepath),
      useSharedStrings: true,
      useStyles: true,
    });

    this.createWorksheet();
  }

  createWorksheet() {
    if (this.writeStream) {
      this.worksheet = this.writeStream.addWorksheet('Sheet 1');
    }
  }

  createHeader(header: string[]) {
    if (this.worksheet) {
      this.worksheet.addRow(header).commit();
    }
  }

  async end() {
    await this.writeStream?.commit();
  }

  async delete() {
    const removeFile = (resolve: Function) => {
      unlink(this.filepath, (e) => {
        resolve(e);
      });
    };

    return new Promise((resolve, reject) => {
      try {
        // TODO: Check if ExcelJS.stream.xlsx.WorkbookWriter has a way to check if stream is done
        // if (!this.writeStream.writableFinished) {
        //   this.end(() => removeFile(resolve));
        // } else {
        //   removeFile(resolve);
        // }
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
