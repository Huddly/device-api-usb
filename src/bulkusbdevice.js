"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var path_1 = require("path");
var await_sleep_1 = require("await-sleep");
var errstr_1 = require("./errstr");
var bulkusbendpoint_1 = require("./bulkusbendpoint");
var binding = require('node-gyp-build')(path_1["default"].join(__dirname, '..'));
var BulkUsbDevice = /** @class */ (function () {
    function BulkUsbDevice(cpp, information) {
        this._cpp = cpp;
        this.vid = information.vid;
        this.pid = information.pid;
        this.serialNumber = information.serial;
        this.location = Object.freeze(information.location);
        this._cookie = information.cookie;
        this._onDetaches = [];
        this._openEndpoint = undefined;
    }
    BulkUsbDevice.prototype.onDetach = function (cb) {
        if (this._openEndpoint && !this._openEndpoint.isAttached) {
            setImmediate(cb);
        }
        else {
            this._onDetaches.push(cb);
        }
    };
    BulkUsbDevice.prototype.open = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            return _this._cpp.openDevice(_this._cookie, function (handle) {
                if (typeof handle !== 'object') {
                    return reject(errstr_1["default"](handle));
                }
                var device = new bulkusbendpoint_1["default"](_this._cpp, _this, handle);
                _this._openEndpoint = device;
                return resolve(device);
            });
        });
    };
    BulkUsbDevice.prototype.equals = function (other) {
        return this._cookie === other._cookie;
    };
    return BulkUsbDevice;
}());
exports.BulkUsbDevice = BulkUsbDevice;
var BulkUsbSingleton = /** @class */ (function () {
    function BulkUsbSingleton(cpp) {
        this._cpp = cpp;
        this._activeDevices = Object.freeze([]);
        this._previousDevices = Object.freeze([]);
        this._onAttaches = [];
        this._isPolling = false;
        this._pollingListResolve = [];
    }
    Object.defineProperty(BulkUsbSingleton, "Instance", {
        get: function () {
            return this._instance || (this._instance = new this(binding));
        },
        enumerable: true,
        configurable: true
    });
    BulkUsbSingleton.prototype._listDevices = function () {
        var _this = this;
        this._previousDevices = this._activeDevices;
        this._activeDevices = Object.freeze([]);
        return new Promise(function (resolve, reject) {
            _this._cpp.listDevices(function (devices) {
                if (typeof devices !== 'object') {
                    return reject(errstr_1["default"](devices));
                }
                var newList = Object.freeze(devices.map(function (dev) { return new BulkUsbDevice(_this._cpp, dev); }));
                var newDevices = [];
                var ret = newList.map(function (newDevice) {
                    var oldDevice = _this._previousDevices.find(function (x) { return x.equals(newDevice); });
                    if (oldDevice) {
                        return oldDevice;
                    }
                    newDevices.push(newDevice);
                    return newDevice;
                });
                var removedDevices = _this._previousDevices.filter(function (prevDevice) { return !ret.find(function (curDevice) { return curDevice.equals(prevDevice); }); });
                removedDevices.forEach(function (d) {
                    d._onDetaches.forEach(function (cb) { return cb(d); });
                    if (d._openEndpoint) {
                        d._openEndpoint.isAttached = false;
                    }
                });
                _this._activeDevices = Object.freeze(ret.slice());
                newDevices.forEach(function (newDevice) { return _this._onAttaches.forEach(function (cb) { return cb(newDevice); }); });
                return resolve(Object.freeze(ret));
            });
        });
    };
    BulkUsbSingleton.prototype._pollLoop = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _loop_1, this_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this._isPolling = true;
                        _loop_1 = function () {
                            var toResolve, devices_1, e_1;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        toResolve = this_1._pollingListResolve;
                                        this_1._pollingListResolve = [];
                                        _a.label = 1;
                                    case 1:
                                        _a.trys.push([1, 3, , 5]);
                                        return [4 /*yield*/, this_1._listDevices()];
                                    case 2:
                                        devices_1 = _a.sent();
                                        toResolve.map(function (cb) { return cb(devices_1); });
                                        return [3 /*break*/, 5];
                                    case 3:
                                        e_1 = _a.sent();
                                        console.log("BulkUsb attach poll loop got error: " + e_1);
                                        return [4 /*yield*/, await_sleep_1["default"](1000)];
                                    case 4:
                                        _a.sent(); // Sleep some more to avoid spamming.
                                        return [3 /*break*/, 5];
                                    case 5: return [4 /*yield*/, await_sleep_1["default"](250)];
                                    case 6:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        };
                        this_1 = this;
                        _a.label = 1;
                    case 1: return [5 /*yield**/, _loop_1()];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    BulkUsbSingleton.prototype.listDevices = function () {
        var _this = this;
        if (!this._isPolling) {
            return this._listDevices();
        }
        return new Promise(function (resolve) {
            _this._pollingListResolve.push(resolve);
        });
    };
    BulkUsbSingleton.prototype.onAttach = function (cb) {
        return __awaiter(this, void 0, void 0, function () {
            var devices;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this._isPolling) {
                            this._pollLoop(); // Just drop the promise, as it will never resolve (infinite pollLoop)
                        }
                        return [4 /*yield*/, this.listDevices()];
                    case 1:
                        devices = _a.sent();
                        this._onAttaches.push(cb);
                        return [4 /*yield*/, Promise.all(devices.map(cb))];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return BulkUsbSingleton;
}());
exports.BulkUsbSingleton = BulkUsbSingleton;
exports["default"] = BulkUsbSingleton.Instance;
