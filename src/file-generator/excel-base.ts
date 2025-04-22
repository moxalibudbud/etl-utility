import { createWriteStream, unlink } from 'fs';
import * as ExcelJS from 'exceljs';

type ExcelBaseOptions = {
  filename: string;
  path?: string;
}

export interface ExcelBaseMethods {
  push(...args: any[]): any;
}

export class ExcelBase {

  writeStream: ExcelJS.stream.xlsx.WorkbookWriter;
  filename: string;
  filepath: string;
  worksheet: any;

  constructor(options: ExcelBaseOptions) {
    const path = options?.path ? options.path : '/var/tmp';
    this.filename = options.filename;
    this.filepath = `${path}/${this.filename}`;

    this.writeStream = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: createWriteStream(this.filepath),
      useSharedStrings: true,
      useStyles: true,
    });

    this.worksheet = this.writeStream.addWorksheet('Sheet 1');
  }

  async end() {
    await this.writeStream.commit();
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

}