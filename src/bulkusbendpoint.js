"use strict";
exports.__esModule = true;
var errstr_1 = require("./errstr");
var BulkUsbEndpoint = /** @class */ (function () {
    function BulkUsbEndpoint(cpp, device, information) {
        this._cpp = cpp;
        this.device = device;
        this._cookie = information.handle;
        this.isAttached = true;
    }
    BulkUsbEndpoint.prototype.write = function (data, timeoutMs) {
        var _this = this;
        var u8 = Uint8Array.from(data);
        return new Promise(function (resolve, reject) {
            if (!_this.isAttached) {
                reject(new Error('LIBUSB_ERROR_NO_DEVICE'));
            }
            _this._cpp.writeDevice(_this._cookie, u8, timeoutMs, function (ret) {
                if (ret < 0) {
                    var error = errstr_1["default"](ret);
                    if (error.message === 'LIBUSB_ERROR_NO_DEVICE') {
                        _this.isAttached = false;
                        _this.device._onDetaches.forEach(function (cb) { return cb(_this.device); });
                    }
                    return reject(error);
                }
                return resolve(ret);
            });
        });
    };
    BulkUsbEndpoint.prototype.read = function (maxSize, timeoutMs) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (!_this.isAttached) {
                reject(new Error('LIBUSB_ERROR_NO_DEVICE'));
            }
            _this._cpp.readDevice(_this._cookie, maxSize, timeoutMs, function (ret) {
                if (typeof ret !== 'object') {
                    var error = errstr_1["default"](ret);
                    if (error.message === 'LIBUSB_ERROR_NO_DEVICE') {
                        _this.isAttached = false;
                        _this.device._onDetaches.forEach(function (cb) { return cb(_this.device); });
                    }
                    return reject(error);
                }
                return resolve(Buffer.from(ret.data));
            });
        });
    };
    BulkUsbEndpoint.prototype.close = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (!_this.isAttached) {
                reject(new Error('LIBUSB_ERROR_NO_DEVICE'));
            }
            _this._cpp.closeDevice(_this._cookie, function (ret) {
                if (ret < 0) {
                    return reject(errstr_1["default"](ret));
                }
                return resolve(undefined);
            });
        });
    };
    return BulkUsbEndpoint;
}());
exports.BulkUsbEndpoint = BulkUsbEndpoint;
exports["default"] = BulkUsbEndpoint;
