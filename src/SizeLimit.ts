import bytes from 'bytes';

interface IResult {
  name: string;
  size: number;
  sizeLimit?: number;
  running?: number;
  loading?: number;
  total?: number;
}

const EmptyResult = {
  name: '-',
  size: 0,
  running: 0,
  loading: 0,
  total: 0,
};

class SizeLimit {
  static SIZE_RESULTS_HEADER = ['Name', 'Size', 'Delta', 'Limit check'];

  static TIME_RESULTS_HEADER = [
    'Name',
    'Size',
    'Loading time (3g)',
    'Running time (snapdragon)',
    'Total time',
  ];

  private formatBytes(size: number): string {
    return bytes.format(size, { unitSeparator: ' ' });
  }

  private formatTime(seconds: number): string {
    if (seconds >= 1) {
      return `${Math.ceil(seconds * 10) / 10} s`;
    }

    return `${Math.ceil(seconds * 1000)} ms`;
  }

  private formatChange(base: number = 0, current: number = 0): string {
    if (base === 0) {
      return `+100% 🔺`;
    }

    const value = ((current - base) / base) * 100;
    const formatted = (Math.sign(value) * Math.ceil(Math.abs(value) * 100)) / 100;

    if (value > 0) {
      return `+${formatted}% 🔺`;
    }

    if (value === 0) {
      return `${formatted}%`;
    }

    return `${formatted}% 🟢`;
  }

  private formatSizeChange(base: number = 0, current: number = 0): string {
    if (base === 0) {
      const valueInBytes = this.formatBytes(current);
      return `${valueInBytes} (+100% 🔺)`;
    }

    const value = ((current - base) / base) * 100;
    const valueInBytes = this.formatBytes(current - base);
    const formatted = (Math.sign(value) * Math.ceil(Math.abs(value) * 100)) / 100;

    if (value > 0) {
      return `${valueInBytes} (+${formatted}% 🔺)`;
    }

    if (value === 0) {
      return `${valueInBytes} (0% 🟢)`;
    }

    return `${valueInBytes} (${formatted}% 🟢)`;
  }

  private formatLine(value: string, change?: string) {
    return change ? `${value} (${change})` : `${value}`;
  }

  private formatSizeResult(name: string, base: IResult, current: IResult): Array<string> {
    return [
      name,
      this.formatBytes(current.size),
      this.formatSizeChange(base.size, current.size),
      `${this.formatBytes(current.sizeLimit)} (${current.size > current.sizeLimit ? `${this.formatBytes(current.size - current.sizeLimit)} ❌` : '✅'})`,
    ];
  }

  private formatTimeResult(name: string, base: IResult, current: IResult): Array<string> {
    return [
      name,
      this.formatLine(this.formatBytes(current.size), this.formatChange(base.size, current.size)),
      this.formatLine(
        this.formatTime(current.loading),
        this.formatChange(base.loading, current.loading),
      ),
      this.formatLine(
        this.formatTime(current.running),
        this.formatChange(base.running, current.running),
      ),
      this.formatTime(current.total),
    ];
  }

  parseResults(output: string): { [name: string]: IResult } {
    const results = JSON.parse(output);

    // flatten the inner array values if any
    // From
    // [
    //   [{ name: 'a', size: 1 }, { name: 'b', size: 2 }],
    //   [{ name: 'c', size: 1 }, { name: 'd', size: 2 }],
    // ]
    // To
    // [{ name: 'a', size: 1 }, { name: 'b', size: 2 }, { name: 'c', size: 1 }, { name: 'd', size: 2 }]
    const flattenedResults: any[] = [];
    for (const result of results) {
      if (Array.isArray(result)) {
        flattenedResults.push(...result);
      } else {
        flattenedResults.push(result);
      }
    }

    return flattenedResults.reduce((current: { [name: string]: IResult }, result: any) => {
      let time = {};

      if (result.loading !== undefined && result.running !== undefined) {
        const loading = +result.loading;
        const running = +result.running;

        time = {
          running,
          loading,
          total: loading + running,
        };
      }

      return {
        ...current,
        [result.name]: {
          name: result.name,
          size: +result.size,
          sizeLimit: +result.sizeLimit,
          ...time,
        },
      };
    }, {});
  }

  formatResults(
    base: { [name: string]: IResult },
    current: { [name: string]: IResult },
  ): Array<Array<string>> {
    const names = [...new Set([...Object.keys(base), ...Object.keys(current)])];
    const isSize = names.some((name: string) => current[name] && current[name].total === undefined);
    const header = isSize ? SizeLimit.SIZE_RESULTS_HEADER : SizeLimit.TIME_RESULTS_HEADER;
    const fields = names.map((name: string) => {
      const baseResult = base[name] || EmptyResult;
      const currentResult = current[name] || EmptyResult;

      if (isSize) {
        return this.formatSizeResult(name, baseResult, currentResult);
      }
      return this.formatTimeResult(name, baseResult, currentResult);
    });

    return [header, ...fields];
  }
}
export default SizeLimit;
