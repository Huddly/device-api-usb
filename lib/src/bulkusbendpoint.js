"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const errstr_1 = __importDefault(require("./errstr"));
class BulkUsbEndpoint {
    constructor(cpp, device, information) {
        this._cpp = cpp;
        this.device = device;
        this._cookie = information.handle;
        this.isAttached = true;
    }
    write(data, timeoutMs) {
        const u8 = Uint8Array.from(data);
        return new Promise((resolve, reject) => {
            if (!this.isAttached) {
                reject(new Error('LIBUSB_ERROR_NO_DEVICE'));
            }
            this._cpp.writeDevice(this._cookie, u8, timeoutMs, (ret) => {
                if (ret < 0) {
                    const error = errstr_1.default(ret);
                    if (error.message === 'LIBUSB_ERROR_NO_DEVICE') {
                        this.isAttached = false;
                        this.device._onDetaches.forEach(cb => cb(this.device));
                    }
                    return reject(error);
                }
                return resolve(ret);
            });
        });
    }
    read(maxSize, timeoutMs) {
        return new Promise((resolve, reject) => {
            if (!this.isAttached) {
                reject(new Error('LIBUSB_ERROR_NO_DEVICE'));
            }
            this._cpp.readDevice(this._cookie, maxSize, timeoutMs, (ret) => {
                if (typeof ret !== 'object') {
                    const error = errstr_1.default(ret);
                    if (error.message === 'LIBUSB_ERROR_NO_DEVICE') {
                        this.isAttached = false;
                        this.device._onDetaches.forEach(cb => cb(this.device));
                    }
                    return reject(error);
                }
                return resolve(Buffer.from(ret.data));
            });
        });
    }
    close() {
        return new Promise((resolve, reject) => {
            if (!this.isAttached) {
                reject(new Error('LIBUSB_ERROR_NO_DEVICE'));
            }
            this._cpp.closeDevice(this._cookie, (ret) => {
                if (ret < 0) {
                    return reject(errstr_1.default(ret));
                }
                return resolve(undefined);
            });
        });
    }
}
exports.BulkUsbEndpoint = BulkUsbEndpoint;
exports.default = BulkUsbEndpoint;
//# sourceMappingURL=bulkusbendpoint.js.map