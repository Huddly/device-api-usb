"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const await_sleep_1 = __importDefault(require("await-sleep"));
const errstr_1 = __importDefault(require("./errstr"));
const bulkusbendpoint_1 = __importDefault(require("./bulkusbendpoint"));
const binding = require('node-gyp-build')(path_1.default.join(__dirname, '..'));
class BulkUsbDevice {
    constructor(cpp, information) {
        this._cpp = cpp;
        this.vid = information.vid;
        this.pid = information.pid;
        this.serialNumber = information.serial;
        this.location = Object.freeze(information.location);
        this._cookie = information.cookie;
        this._onDetaches = [];
        this._openEndpoint = undefined;
    }
    onDetach(cb) {
        if (this._openEndpoint && !this._openEndpoint.isAttached) {
            setImmediate(cb);
        }
        else {
            this._onDetaches.push(cb);
        }
    }
    open() {
        return new Promise((resolve, reject) => {
            return this._cpp.openDevice(this._cookie, (handle) => {
                if (typeof handle !== 'object') {
                    return reject(errstr_1.default(handle));
                }
                const device = new bulkusbendpoint_1.default(this._cpp, this, handle);
                this._openEndpoint = device;
                return resolve(device);
            });
        });
    }
    equals(other) {
        return this._cookie === other._cookie;
    }
}
exports.BulkUsbDevice = BulkUsbDevice;
class BulkUsbSingleton {
    constructor(cpp) {
        this._cpp = cpp;
        this._activeDevices = Object.freeze([]);
        this._previousDevices = Object.freeze([]);
        this._onAttaches = [];
        this._isPolling = false;
        this._firstListResolve = [];
        this._firstListDone = false;
    }
    static get Instance() {
        return this._instance || (this._instance = new this(binding));
    }
    _listDevices() {
        this._previousDevices = this._activeDevices;
        this._activeDevices = Object.freeze([]);
        return new Promise((resolve, reject) => {
            this._cpp.listDevices((devices) => {
                if (typeof devices !== 'object') {
                    return reject(errstr_1.default(devices));
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
                const removedDevices = this._previousDevices.filter(prevDevice => !ret.find(curDevice => curDevice.equals(prevDevice)));
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
    _pollLoop() {
        return __awaiter(this, void 0, void 0, function* () {
            this._isPolling = true;
            console.log('Starting BulkUsb poll loop');
            for (;;) {
                try {
                    const devices = yield this._listDevices();
                    this._firstListDone = true;
                    const promise = Promise.all(this._firstListResolve.map(cb => cb(devices)));
                    this._firstListResolve = [];
                    yield promise;
                }
                catch (e) {
                    console.log('BulkUsb attach poll loop got error:', e);
                    yield await_sleep_1.default(1000); // Sleep some more to avoid spamming.
                }
                yield await_sleep_1.default(250);
            }
        });
    }
    listDevices() {
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
    onAttach(cb) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this._isPolling) {
                this._pollLoop(); // Just drop the promise, as it will never resolve (infinite pollLoop)
            }
            const devices = yield this.listDevices();
            this._onAttaches.push(cb);
            yield Promise.all(devices.map(cb));
        });
    }
}
exports.default = BulkUsbSingleton.Instance;
//# sourceMappingURL=bulkusbdevice.js.map