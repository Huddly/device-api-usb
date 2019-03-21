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
const bulkusbdevice_1 = __importDefault(require("./bulkusbdevice"));
const logger_1 = __importDefault(require("./logger"));
class DeviceDiscoveryManager {
    constructor(logger) {
        this.HUDDLY_VID = 0x2bd9;
        this.attachedDevices = [];
        this.logger = logger || new logger_1.default(true);
    }
    registerForHotplugEvents(eventEmitter) {
        this.eventEmitter = eventEmitter;
        bulkusbdevice_1.default.onAttach(this.deviceAttached.bind(this));
    }
    getDeviceObject(device) {
        let name;
        switch (device.pid) {
            case 0x11:
                name = 'Huddly GO';
                break;
            case 0x21:
                name = 'Huddly IQ';
                break;
            default:
                throw new Error('Unknown device');
        }
        Object.assign(device, {
            id: device._cookie,
            productId: device.pid,
            productName: name
        });
        return device;
    }
    destroy() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
    }
    discoverCameras() {
    }
    deviceAttached(attachedDevice) {
        if (attachedDevice.vid !== this.HUDDLY_VID) {
            return;
        }
        const newDevice = this.getDeviceObject(attachedDevice);
        newDevice.onDetach(this.deviceDetached.bind(this));
        this.attachedDevices.push(newDevice);
        this.eventEmitter.emit('ATTACH', newDevice);
    }
    deviceDetached(removedDevice) {
        if (removedDevice.vid !== this.HUDDLY_VID) {
            return;
        }
        this.attachedDevices = this.attachedDevices.filter(d => !removedDevice.equals(d));
        this.eventEmitter.emit('DETACH', removedDevice.serialNumber);
    }
    deviceList() {
        return __awaiter(this, void 0, void 0, function* () {
            // Fixme: Do dummy attach to init polling
            bulkusbdevice_1.default.onAttach(() => __awaiter(this, void 0, void 0, function* () { }));
            const allDevices = yield bulkusbdevice_1.default.listDevices();
            const devices = allDevices.filter(dev => dev.vid === 0x2bd9);
            return { devices };
        });
    }
    getDevice(serialNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            const { devices } = yield this.deviceList();
            if (serialNumber) {
                return devices.find(d => d.serialNumber.indexOf(serialNumber) >= 0);
            }
            else if (devices.length > 0) {
                if (devices.length !== 1) {
                    this.logger.warn(`Randomly choosing between ${devices.length} Huddly devices (${devices[0].serialNumber})`);
                }
                return devices[0];
            }
            this.logger.warn(`Could not find device with serial ${serialNumber} amongst ${devices.length} devices`);
            return undefined;
        });
    }
}
exports.default = DeviceDiscoveryManager;
//# sourceMappingURL=manager.js.map