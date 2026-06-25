import { SourceLineBase } from '../../../line-data/source-line-base';
import { mapWithDefault } from '../../../utils';
import { skuSerial } from '../../..//utils/sku-serial';
import { OctoplusLineOptions } from './octoplus-etl';

type Options = OctoplusLineOptions & { currentLineNumber: number };

export class OctoplusSourceLine extends SourceLineBase {
  constructor(line: string, options: Options) {
    super(line, options);
  }

  get output() {
    const { skuField } = this.options as Options;
    const octoplusSKU = this.jsonLine[skuField];
    const { sku, serial, isSerialized } = skuSerial(octoplusSKU).decode();

    const jsonLine = {
      ...this.jsonLine,
      octoplus_sku: sku,
      octoplus_batchsn: serial,
      octoplus_is_serialized: isSerialized,
    };

    const output = mapWithDefault(jsonLine || {}, this.options.outputMappings);
    return output;
  }
}
