// TODO: Work on this

import { FlatFileBaseLazy, FlatFileBaseLazyMethods, FlatFileBaseLazyOptions } from './flat-file-base-lazy';
import { DatascanCountLineModel } from '@lib/etl/models/datascan-count-line-model';
import { DatascanCountFileLine } from '@lib/etl/util/datascan-count-file-utils';
import * as utils from '../../util/siocs-count-file-utils';

export type SiocsCountFileGeneratorOptions = FlatFileBaseLazyOptions & {
  countDate: string;
};

export class DefaultGenerator extends FlatFileBaseLazy implements FlatFileBaseLazyMethods {
  countDate: string;

  constructor(options: SiocsCountFileGeneratorOptions) {
    super(options);
    this.countDate = options.countDate;
  }

  /**
   * File definition: STK_{date in YYYYMMDDHHMMSS format}_{STORE ID}.dat
   * Sample filename: STK_20230123000002_30104.dat
   * @param args
   */
  setFilename(line: DatascanCountFileLine) {
    this.filename = utils.setFilename(line);
  }

  /**
   * This method is purposely invoked on "close" event of readline module of alshaya-count-file-etl.
   * That's a good touchpoint to generate the footer of SIOCS count file
   *
   */
  pushFooter() {
    this.writeStream?.write(utils.buildFooter());
  }

  pushHeader(line: DatascanCountFileLine) {
    this.createHeader(utils.buildHeader(line));
  }

  push(lineModel: DatascanCountLineModel) {
    const line = lineModel.jsonLine as DatascanCountFileLine;

    if (!this.filename) {
      this.setFilename(line);
    }

    if (!this.writeStream) {
      this.createStream();

      // Push the header because stream is also created
      this.pushHeader(line);
    }

    this.writeStream?.write(utils.buildLine(line, { countDate: this.countDate }));
  }
}
