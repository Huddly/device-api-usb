import path from 'path';
import sleep from 'await-sleep';
import errstr from './errstr';
import BulkUsbEndpoint from './bulkusbendpoint';
import { IDevice } from './types';
const binding = require('node-gyp-build')(path.join(__dirname, '..'));

export class BulkUsbDevice implements IDevice {
  private _cpp: any;
  vid: number;
  productId: number;
  productName: string;
  serial: string;
  location: ReadonlyArray<number>;
  private _cookie: number;
  /** @internal */
  _onDetaches: Array<(dev: BulkUsbDevice) => void>;
  /** @internal */
  _openEndpoint: undefined | BulkUsbEndpoint;

  constructor(cpp: any, information: any) {
    this._cpp = cpp;
    this.vid = information.vid;
    this.productId = information.pid;
    this.productName = 'Huddly IQ'; // TODO
    this.serial = information.serial;
    this.location = Object.freeze(information.location);
    this._cookie = information.cookie;
    this._onDetaches = [];
    this._openEndpoint = undefined;
  }

  onDetach(cb: (dev: this) => void) {
    if (this._openEndpoint && !this._openEndpoint.isAttached) {
      setImmediate(cb);
    } else {
      this._onDetaches.push(cb);
    }
  }

  open(): Promise<BulkUsbEndpoint> {
    return new Promise((resolve, reject) => {
      return this._cpp.openDevice(this._cookie, (handle) => {
        if (typeof handle !== 'object') {
          return reject(errstr(handle));
        }
        const device = new BulkUsbEndpoint(this._cpp, this, handle);
        this._openEndpoint = device;
        return resolve(device);
      });
    });
  }

  equals(other: BulkUsbDevice): boolean {
    return this._cookie === other._cookie;
  }
}

class BulkUsbSingleton {
  private static _instance: BulkUsbSingleton;
  private _cpp: any;
  private _activeDevices: ReadonlyArray<BulkUsbDevice>;
  private _previousDevices: ReadonlyArray<BulkUsbDevice>;
  private _onAttaches: Array<(dev: BulkUsbDevice) => Promise<void>>;
  private _isPolling: boolean;
  private _firstListResolve: Array<(dev: ReadonlyArray<BulkUsbDevice>) => void>;
  private _firstListDone: boolean;

  private constructor(cpp: any) {
      this._cpp = cpp;
      this._activeDevices = Object.freeze([]);
      this._previousDevices = Object.freeze([]);
      this._onAttaches = [];
      this._isPolling = false;
      this._firstListResolve = [];
      this._firstListDone = false;
  }
  public static get Instance() {
      return this._instance || (this._instance = new this(binding));
  }
  private _listDevices(): Promise<ReadonlyArray<BulkUsbDevice>> {
      this._previousDevices = this._activeDevices;
      this._activeDevices = Object.freeze([]);
      return new Promise((resolve, reject) => {
        this._cpp.listDevices((devices: Array<any>) => {
          if (typeof devices !== 'object') {
            return reject(errstr(devices));
          }
          const newList = Object.freeze(devices.map(dev => new BulkUsbDevice(this._cpp, dev)));
          const newDevices = [];
          const ret = newList.map((newDevice) => {
            const oldDevice = this._previousDevices.find(x => x.equals(newDevice));
            if (oldDevice) {
              return oldDevice;
            }
            newDevices.push(newDevice);
            return newDevice;
          });

          const removedDevices = this._previousDevices.filter(
            prevDevice => !ret.find(curDevice => curDevice.equals(prevDevice))
          );

          removedDevices.forEach((d) => {
            d._onDetaches.forEach(cb => cb(d));
            if (d._openEndpoint) {
              d._openEndpoint.isAttached = false;
            }
          });

          this._activeDevices = Object.freeze(ret.slice());

          newDevices.forEach(newDevice => this._onAttaches.forEach(cb => cb(newDevice)));
          return resolve(Object.freeze(ret));
        });
      });
  }

  private async _pollLoop() {
    this._isPolling = true;
    console.log('Starting BulkUsb poll loop');
    for (;;) {
      try {
        const devices = await this._listDevices();
        this._firstListDone = true;
        const promise = Promise.all(this._firstListResolve.map(cb => cb(devices)));
        this._firstListResolve = [];
        await promise;
      } catch (e) {
        console.log('BulkUsb attach poll loop got error:', e);
        await sleep(1000); // Sleep some more to avoid spamming.
      }
      await sleep(250);
    }
  }

  listDevices(): Promise<ReadonlyArray<BulkUsbDevice>> {
    if (!this._isPolling) {
      return this._listDevices();
    }
    if (!this._firstListDone) {
      return new Promise((resolve) => {
        this._firstListResolve.push(resolve);
      });
    }
    return new Promise((resolve) => {
      let devices = this._activeDevices;
      if (devices.length === 0) {
        devices = this._previousDevices;
      }
      return resolve(devices);
    });
  }

  async onAttach(cb: (dev: BulkUsbDevice) => Promise<void>) {
    if (!this._isPolling) {
      this._pollLoop(); // Just drop the promise, as it will never resolve (infinite pollLoop)
    }
    const devices = await this.listDevices() as any[];
    this._onAttaches.push(cb);
    await Promise.all(devices.map(cb));
  }
}

export default BulkUsbSingleton.Instance;
