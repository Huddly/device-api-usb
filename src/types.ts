export interface IOpenDevice {
  write(data: Buffer, timeoutMs: Number): Promise<number>;
  read(maxSize: Number, timeoutMs: Number): Promise<Buffer>;
  close(): Promise<undefined>;
}

export interface IDevice {
    readonly productId: number;
    readonly productName: string;
    readonly vid: number;
    readonly serial: string;

    onDetach(cb: (dev: this) => void): void;
    open(): Promise<IOpenDevice>;
    equals(other: this): boolean;
}

export interface ILogger {
  verbose: boolean;
  warn(message: string): void;
  info(message: string): void;
  debug(message: string): void;
  error(string): void;
}
