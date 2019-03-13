import { ILogger } from './types';

export default class Logger implements ILogger {
  _verbose: boolean;

  constructor(verbose: boolean = true) {
    this._verbose = verbose;
  }

  warn(message: string): void {
    if (this.verbose) console.warn(message);
  }

  info(message: string): void {
    if (this.verbose) {
      console.log(message);
    }
  }

  debug(message: string): void {
    if (this.verbose) {
      console.log(message);
    }
  }

  error(string): void {
    console.error(string);
  }

  get verbose(): boolean {
    return this._verbose;
  }

  set verbose(verbose: boolean) {
    this._verbose = verbose;
  }
}
