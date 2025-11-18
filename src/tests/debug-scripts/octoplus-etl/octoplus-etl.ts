import { FlatFileBaseLazy, FlatFileBaseLazyMethods } from '../../../file-generator/flat-file-base-lazy';
import { ETL } from '../../../etl';
import { OctoplusSourceLine } from './octoplus-source-line';
import { SourceLine, SourceLineBaseOptions } from '../../../line-data';

export type OctoplusLineOptions = SourceLineBaseOptions & { skuField: string };

type ETLOptions = {
  line: OctoplusLineOptions;
  filesource: { blobURL: string; file?: never } | { file: string; blobURL?: never };

  // True = Reject the entire validation if atleast one row is invalid. Else, just skip
  // False/undefined = Just skip the invalid row in the output (default)
  rejectOnInvalidRow?: boolean;
};

export class OctoplusOutfileETL extends ETL {
  constructor(args: ETLOptions, outputFileWriter: FlatFileBaseLazy & FlatFileBaseLazyMethods) {
    super(args, outputFileWriter);
  }

  onLineHandler(chunk: string) {
    try {
      this.lineIndex++;

      const options = {
        ...this.options.line,
        currentLineNumber: this.lineIndex,
      };

      const lineModel = new OctoplusSourceLine(chunk, options as OctoplusLineOptions & { currentLineNumber: number });
      this.populate(lineModel);
    } catch (error) {
      this.lineReader.readlineInterface?.emit('error', error);
    }
  }
}
