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
const transport_1 = __importDefault(require("./transport"));
const manager_1 = __importDefault(require("./manager"));
const logger_1 = __importDefault(require("./logger"));
class HuddlyDeviceAPIUSB {
    constructor(opts = {}) {
        this.logger = opts.logger || new logger_1.default();
        this.deviceDiscoveryManager = opts.manager || new manager_1.default(this.logger);
    }
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
        });
    }
    registerForHotplugEvents(eventEmitter) {
        this.eventEmitter = eventEmitter;
        this.deviceDiscoveryManager.registerForHotplugEvents(eventEmitter);
    }
    getDeviceDiscoveryAPI() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.deviceDiscoveryManager;
        });
    }
    getValidatedTransport(device) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const transport = yield this.getTransport(device);
                yield transport.performHlinkHandshake();
                this.logger.info(':::::::::::: Transport Protocol is HLINK ::::::::::::');
                return transport;
            }
            catch (e) {
                this.logger.warn(`HLink is not supported for device: ${device.serialNumber}`);
                return undefined;
            }
        });
    }
    getTransport(device) {
        return __awaiter(this, void 0, void 0, function* () {
            const usbDevice = yield this.deviceDiscoveryManager.getDevice(device.serialNumber);
            const transport = new transport_1.default(usbDevice, this.logger);
            yield transport.init();
            return transport;
        });
    }
    isUVCControlsSupported(device) {
        return __awaiter(this, void 0, void 0, function* () {
            return Promise.resolve(false);
        });
    }
    getUVCControlAPIForDevice(device) {
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error('UVCControlInterface API not available for node-usb');
        });
    }
    isHIDSupported(device) {
        return __awaiter(this, void 0, void 0, function* () {
            return Promise.resolve(false);
        });
    }
    getHIDAPIForDevice(device) {
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error('HID Unsupported for device-api usb');
        });
    }
}
exports.default = HuddlyDeviceAPIUSB;
//# sourceMappingURL=index.js.map