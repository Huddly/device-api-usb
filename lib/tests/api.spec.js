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
const chai_1 = __importDefault(require("chai"));
const sinon_chai_1 = __importDefault(require("sinon-chai"));
const sinon_1 = __importDefault(require("sinon"));
const transport_1 = __importDefault(require("./../src/transport"));
const index_1 = __importDefault(require("./../src/index"));
const events_1 = require("events");
const expect = chai_1.default.expect;
chai_1.default.should();
chai_1.default.use(sinon_chai_1.default);
const mockedDevices = [
    {
        productName: 'Huddly IQ',
        serialNumber: '123456'
    },
    {
        productName: 'Huddly IQ',
        serialNumber: '56789'
    },
];
const dummyLogger = {
    warn: () => { },
    info: () => { },
    error: () => { }
};
const dummyDeviceDiscoveryManager = {
    registerForHotplugEvents: () => { },
    discoverCameras: () => { },
    deviceList: () => { return mockedDevices; },
    getDevice: () => { }
};
describe('HuddlyDeviceApiUSB', () => {
    let deviceApi;
    beforeEach(() => {
        deviceApi = new index_1.default({
            logger: dummyLogger,
            manager: dummyDeviceDiscoveryManager
        });
    });
    describe('#registerForHotplugEvents', () => {
        it('should initialize event emitter and register hotplug events on device manager', () => __awaiter(this, void 0, void 0, function* () {
            const emitter = new events_1.EventEmitter();
            const spy = sinon_1.default.spy(deviceApi.deviceDiscoveryManager, 'registerForHotplugEvents');
            expect(deviceApi.eventEmitter).to.be.undefined;
            yield deviceApi.registerForHotplugEvents(emitter);
            expect(deviceApi.eventEmitter).to.be.instanceof(events_1.EventEmitter);
            expect(spy.callCount).to.equal(1);
        }));
    });
    describe('#getDeviceDiscoveryApi', () => {
        it('should return the device discovery manager instance', () => __awaiter(this, void 0, void 0, function* () {
            const deviceDiscoveryApi = yield deviceApi.getDeviceDiscoveryAPI();
            expect(deviceDiscoveryApi).to.equal(dummyDeviceDiscoveryManager);
        }));
    });
    describe('#getValidatedTransport', () => {
        let trasnportstub;
        let getTransportStub;
        beforeEach(() => {
            trasnportstub = sinon_1.default.createStubInstance(transport_1.default);
        });
        afterEach(() => {
            getTransportStub.restore();
        });
        it('should support device when hlink handshake succeeds', () => __awaiter(this, void 0, void 0, function* () {
            trasnportstub.performHlinkHandshake.returns(Promise.resolve());
            getTransportStub = sinon_1.default.stub(deviceApi, 'getTransport').returns(trasnportstub);
            const supported = yield deviceApi.getValidatedTransport(mockedDevices[0]);
            expect(supported).to.be.instanceof(transport_1.default);
        }));
        it('should not support device when hlink handshake fails', () => __awaiter(this, void 0, void 0, function* () {
            trasnportstub.performHlinkHandshake.returns(Promise.reject());
            getTransportStub = sinon_1.default.stub(deviceApi, 'getTransport').returns(trasnportstub);
            const supported = yield deviceApi.getValidatedTransport(mockedDevices[0]);
            expect(supported).to.equal(undefined);
        }));
    });
    describe('#isUVCControlsSupported', () => {
        it('should not support UVC controls', () => __awaiter(this, void 0, void 0, function* () {
            const uvcSupport = yield deviceApi.isUVCControlsSupported(mockedDevices[0]);
            expect(uvcSupport).to.equal(false);
        }));
    });
    describe('#getUVCControlAPIForDevice', () => {
        it('should throw error when calling getUVCControlAPIForDevice for node-usb device api', () => __awaiter(this, void 0, void 0, function* () {
            try {
                yield deviceApi.getUVCControlAPIForDevice(mockedDevices[0]);
                expect(true).to.equal(false);
            }
            catch (e) {
                expect(e.message).to.equal('UVCControlInterface API not available for node-usb');
            }
        }));
    });
    describe('#isHIDSupported', () => {
        it('should not support HID', () => __awaiter(this, void 0, void 0, function* () {
            const hidSupport = yield deviceApi.isHIDSupported(mockedDevices[0]);
            expect(hidSupport).to.equal(false);
        }));
    });
    describe('#getHIDApiForDevice', () => {
        it('should throw error when calling getHIDAPIForDevice for node-usb device api', () => __awaiter(this, void 0, void 0, function* () {
            try {
                yield deviceApi.getHIDAPIForDevice(mockedDevices[0]);
                expect(true).to.equal(false);
            }
            catch (e) {
                expect(e.message).to.equal('HID Unsupported for device-api usb');
            }
        }));
    });
});
//# sourceMappingURL=api.spec.js.map