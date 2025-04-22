// TODO: Work on this

import { FlatFileBaseLazy, FlatFileBaseLazyMethods, FlatFileBaseLazyOptions } from './flat-file-base-lazy';
import { LineData } from '../line-data';

export class DefaultGenerator extends FlatFileBaseLazy implements FlatFileBaseLazyMethods {
  constructor(options: FlatFileBaseLazyOptions) {
    super(options);
  }

  /**
   * File definition: STK_{date in YYYYMMDDHHMMSS format}_{STORE ID}.dat
   * Sample filename: STK_20230123000002_30104.dat
   * @param args
   */
  setFilename(line: LineData) {
    this.filename = utils.setFilename(line);
  }

  /**
   * TODO: Need to identify if file comes with a footer
   *
   * This method is purposely invoked on "close" event of readline module of alshaya-count-file-etl.
   * That's a good touchpoint to generate the footer of SIOCS count file
   *
   */
  pushFooter(line: LineData) {
    this.writeStream?.write(utils.buildFooter());
  }

  pushHeader(line: LineData) {
    this.createHeader(utils.buildHeader(line));
  }

  push(lineData: LineData) {
    if (!this.filename) {
      this.setFilename(lineData);
    }

    if (!this.writeStream) {
      this.createStream();

      // Push the header because stream is also created
      // TODO: Need to identify if file comes with a header or not
      this.pushHeader(lineData);
    }

    // TODO: How are we going to biuild line with custom fields
    const row = utils.buildLine(lineData.jsonLine, { countDate: this.countDate });
    this.writeStream?.write(row);
  }
}
