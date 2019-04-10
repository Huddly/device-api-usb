import path from 'path';
import sleep from 'await-sleep';
import errstr from './errstr';
import BulkUsbEndpoint from './bulkusbendpoint';
const binding = require('node-gyp-build')(path.join(__dirname, '..'));

export class BulkUsbDevice {
  private _cpp: any;
  vid: number;
  pid: number;
  serialNumber: string;
  location: ReadonlyArray<number>;
  private _cookie: number;
  /** @internal */
  _onDetaches: Array<(dev: BulkUsbDevice) => void>;
  /** @internal */
  _openEndpoint: undefined | BulkUsbEndpoint;

  constructor(cpp: any, information: any) {
    this._cpp = cpp;
    this.vid = information.vid;
    this.pid = information.pid;
    this.serialNumber = information.serial;
    this.location = Object.freeze(information.location);
    this._cookie = information.cookie;
    this._onDetaches = [];
    this._openEndpoint = undefined;
  }

  onDetach(cb: (dev: BulkUsbDevice) => void) {
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

export class BulkUsbSingleton {
  private static _instance: BulkUsbSingleton;
  private _cpp: any;
  private _activeDevices: ReadonlyArray<BulkUsbDevice>;
  private _previousDevices: ReadonlyArray<BulkUsbDevice>;
  private _onAttaches: Array<(dev: BulkUsbDevice) => Promise<void>>;
  private _isPolling: boolean;
  private _pollingListResolve: Array<(dev: ReadonlyArray<BulkUsbDevice>) => void>;

  constructor(cpp: any) {
      this._cpp = cpp;
      this._activeDevices = Object.freeze([]);
      this._previousDevices = Object.freeze([]);
      this._onAttaches = [];
      this._isPolling = false;
      this._pollingListResolve = [];
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
    for (;;) {
      // Guarantee that the actual _listDevices call is done after the listDevices call.
      // Not before (cached), and not while listing, but after.
      const toResolve = this._pollingListResolve;
      this._pollingListResolve = [];
      try {
        const devices = await this._listDevices();
        toResolve.map(cb => cb(devices));
      } catch (e) {
        console.log(`BulkUsb attach poll loop got error: ${e}`);
        await sleep(1000); // Sleep some more to avoid spamming.
      }
      await sleep(250);
    }
  }

  listDevices(): Promise<ReadonlyArray<BulkUsbDevice>> {
    if (!this._isPolling) {
      return this._listDevices();
    }
    return new Promise((resolve) => {
      this._pollingListResolve.push(resolve);
    });
  }

  async onAttach(cb: (dev: BulkUsbDevice) => Promise<void>): Promise<void> {
    if (!this._isPolling) {
      this._pollLoop(); // Just drop the promise, as it will never resolve (infinite pollLoop)
    }
    const devices = await this.listDevices();
    this._onAttaches.push(cb);
    await Promise.all(devices.map(cb));
  }
}

export default BulkUsbSingleton.Instance;
