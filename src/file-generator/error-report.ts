import { FlatFileBase, FlatFileBaseMethods } from './flat-file-base';

type ErrorReportOptions = {
  filename: string;
  path?: string;
};

export class ErrorReport extends FlatFileBase implements FlatFileBaseMethods {
  invalidRows: number = 0;

  constructor(options: ErrorReportOptions) {
    super({
      ...options,
      filename: `${options.filename}.error.txt`,
    });
  }

  push(line: string) {
    this.writeStream.write(`${line}\n`);
    this.incrementInvalidRowsCount();
  }

  incrementInvalidRowsCount() {
    this.invalidRows++;
  }
}
