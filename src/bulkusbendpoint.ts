import { BulkUsbDevice } from './bulkusbdevice';
import errstr from './errstr';

export class BulkUsbEndpoint {
  private _cpp: any;
  device: BulkUsbDevice;
  private _cookie: number;
  isAttached: boolean;
  /** @internal */
  _onDetaches: Array<Function>;

  constructor(cpp: any, device: BulkUsbDevice, information: any) {
    this._cpp = cpp;
    this.device = device;
    this._cookie = information.handle;
    this.isAttached = true;
  }

  write(data: Buffer, timeoutMs: number): Promise<number> {
    const u8 = Uint8Array.from(data);
    return new Promise((resolve, reject) => {
      if (!this.isAttached) {
        reject(new Error('LIBUSB_ERROR_NO_DEVICE'));
      }
      this._cpp.writeDevice(this._cookie, u8, timeoutMs, (ret) => {
        if (ret < 0) {
          const error = errstr(ret);
          if (error.message === 'LIBUSB_ERROR_NO_DEVICE') {
            this.isAttached = false;
            this._onDetaches.forEach(cb => cb());
          }
          return reject(error);
        }
        return resolve(ret);
      });
    });
  }

  read(maxSize: number, timeoutMs: number): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      if (!this.isAttached) {
        reject(new Error('LIBUSB_ERROR_NO_DEVICE'));
      }
      this._cpp.readDevice(this._cookie, maxSize, timeoutMs, (ret) => {
        if (typeof ret !== 'object') {
          const error = errstr(ret);
          if (error.message === 'LIBUSB_ERROR_NO_DEVICE') {
            this.isAttached = false;
            this._onDetaches.forEach(cb => cb());
          }
          return reject(error);
        }
        return resolve(new Uint8Array(ret.data));
      });
    });
  }

  close(): Promise<undefined> {
    return new Promise((resolve, reject) => {
      if (!this.isAttached) {
        reject(new Error('LIBUSB_ERROR_NO_DEVICE'));
      }
      this._cpp.closeDevice(this._cookie, (ret) => {
        if (ret < 0) {
          return reject(errstr(ret));
        }
        return resolve(undefined);
      });
    });
  }
}

export default BulkUsbEndpoint;
