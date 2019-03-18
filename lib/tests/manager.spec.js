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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const sinon_1 = __importDefault(require("sinon"));
const chai_1 = __importStar(require("chai"));
const sinon_chai_1 = __importDefault(require("sinon-chai"));
const bulkusbdevice_1 = __importDefault(require("./../src/bulkusbdevice"));
const manager_1 = __importDefault(require("./../src/manager"));
const events_1 = require("events");
const logger_1 = __importDefault(require("./../src/logger"));
chai_1.default.should();
chai_1.default.use(sinon_chai_1.default);
chai_1.default.use(require('chai-things')).use(require('chai-as-promised'));
const mockedDevices = [
    {
        vid: 11225,
        pid: 33,
        serialNumber: 'B40I00070',
        location: [0, 2],
        onDetach: sinon_1.default.stub(),
        equals: sinon_1.default.stub(),
        id: '',
    },
    {
        vid: 11225,
        pid: 33,
        serialNumber: 'B40I09970',
        location: [4, 6],
        onDetach: sinon_1.default.stub(),
        equals: sinon_1.default.stub(),
        id: '',
    },
    {
        vid: 0x2bd1,
        pid: 0x22,
        serialNumber: 'ABCDSF',
        location: [1, 3],
        onDetach: sinon_1.default.stub(),
        equals: sinon_1.default.stub(),
        id: '',
    }
];
const dummyLogger = sinon_1.default.createStubInstance(logger_1.default);
describe('HuddlyUsbDeviceManager', () => {
    let devicemanager;
    beforeEach(() => {
        devicemanager = new manager_1.default(dummyLogger);
    });
    afterEach(() => {
    });
    describe('#registerForHotplugEvents', () => {
        describe('#onAttach', () => {
            let emitter;
            let attachStub;
            beforeEach(() => {
                emitter = new events_1.EventEmitter();
                attachStub = sinon_1.default.stub(bulkusbdevice_1.default, 'onAttach');
            });
            afterEach(() => {
                attachStub.restore();
                devicemanager.destroy();
            });
            it('should emit USB_ATTACH when a huddly device is attached', () => {
                const attachPromise = new Promise((resolve) => {
                    emitter.on('ATTACH', (device) => {
                        chai_1.expect(device.serialNumber).to.equal(mockedDevices[0].serialNumber);
                        chai_1.expect(device.productName).to.equal('Huddly IQ');
                        resolve();
                    });
                });
                devicemanager.registerForHotplugEvents(emitter);
                attachStub.callArgWith(0, mockedDevices[0]);
                return attachPromise;
            });
            it('should not emit USB_ATTACH when other devices are attached', () => __awaiter(this, void 0, void 0, function* () {
                const attachSpy = sinon_1.default.spy();
                emitter.on('ATTACH', attachSpy);
                devicemanager.registerForHotplugEvents(emitter);
                yield attachStub.callArgWith(0, mockedDevices[2]);
                chai_1.expect(attachSpy.callCount).to.equal(0);
                chai_1.expect(devicemanager.attachedDevices.length).to.equal(0);
            }));
        });
        describe('#onDetach', () => {
            let emitter;
            let attachStub;
            beforeEach(() => {
                emitter = new events_1.EventEmitter();
                attachStub = sinon_1.default.stub(bulkusbdevice_1.default, 'onAttach');
            });
            afterEach(() => {
                attachStub.restore();
            });
            it('should emit USB_DETACH with serial', () => {
                const detachPromise = new Promise((resolve) => {
                    emitter.on('DETACH', (deviceId) => {
                        chai_1.expect(deviceId).to.equal(mockedDevices[0].serialNumber);
                        resolve();
                    });
                });
                devicemanager.registerForHotplugEvents(emitter);
                attachStub.callArgWith(0, mockedDevices[0]);
                mockedDevices[0].onDetach.callArgWith(0, mockedDevices[0]);
                return detachPromise;
            });
            it('should not emit USB_DETACH when other devices are detached', () => __awaiter(this, void 0, void 0, function* () {
                const detachSpy = sinon_1.default.spy();
                emitter.on('DETACH', detachSpy);
                devicemanager.registerForHotplugEvents(emitter);
                yield attachStub.callArgWith(0, mockedDevices[2]);
                mockedDevices[0].onDetach.callArgWith(0, mockedDevices[2]);
                chai_1.expect(detachSpy.callCount).to.equal(0);
            }));
            it('should remove list from attached devices', () => __awaiter(this, void 0, void 0, function* () {
                const detachSpy = sinon_1.default.spy();
                emitter.on('DETACH', detachSpy);
                devicemanager.registerForHotplugEvents(emitter);
                yield attachStub.callArgWith(0, mockedDevices[2]);
                mockedDevices[0].onDetach.callArgWith(0, mockedDevices[2]);
                chai_1.expect(devicemanager.attachedDevices.length).to.be.equal(0);
            }));
        });
    });
    describe('#disoverCameras', () => {
        let emitter;
        let attachStub;
        beforeEach(() => {
            emitter = new events_1.EventEmitter();
            attachStub = sinon_1.default.stub(bulkusbdevice_1.default, 'onAttach');
        });
        afterEach(() => {
            attachStub.restore();
            devicemanager.destroy();
        });
        it('should fire attach events for all new discovered cameras', (done) => {
            emitter.on('ATTACH', (d) => {
                chai_1.expect(d.serialNumber).to.equals('SRL123');
                done();
            });
            devicemanager.registerForHotplugEvents(emitter);
            attachStub.callArgWith(0, { id: '123', serialNumber: 'SRL123', pid: 0x21, vid: devicemanager.HUDDLY_VID, onDetach: () => { } });
        });
        it('should fire detach events for all undiscovered cached cameras', (done) => {
            emitter.on('DETACH', (serial) => {
                chai_1.expect(serial).to.equals('SRL456');
                done();
            });
            devicemanager.registerForHotplugEvents(emitter);
            attachStub.callArgWith(0, { id: '123', serialNumber: 'SRL123', pid: 0x21, vid: devicemanager.HUDDLY_VID, onDetach: (cb) => {
                    cb({ id: '456', serialNumber: 'SRL456', pid: 0x21, vid: devicemanager.HUDDLY_VID });
                } });
        });
    });
    describe('#deviceList', () => {
        let listDeviceStub;
        beforeEach(() => {
            /* Add device that is not returned from `usb.deviceList`.
            * This device will serve as a detached device.
            */
            listDeviceStub = sinon_1.default.stub(bulkusbdevice_1.default, 'listDevices').resolves([
                { id: '123', serialNumber: 'SRL123', pid: 0x21, vid: devicemanager.HUDDLY_VID, onDetach: (cb) => { } },
            ]);
        });
        afterEach(() => {
            listDeviceStub.restore();
        });
        it('list devices', () => __awaiter(this, void 0, void 0, function* () {
            const { devices } = yield devicemanager.deviceList();
            chai_1.expect(devices[0].serialNumber).to.equals('SRL123');
        }));
    });
    describe('#getDevice', () => {
        let listDeviceStub;
        beforeEach(() => {
            /* Add device that is not returned from `usb.deviceList`.
            * This device will serve as a detached device.
            */
            devicemanager.registerForHotplugEvents(new events_1.EventEmitter());
            listDeviceStub = sinon_1.default.stub(bulkusbdevice_1.default, 'listDevices').resolves(mockedDevices);
        });
        afterEach(() => {
            listDeviceStub.restore();
        });
        it('should return null when serial does not exist', () => __awaiter(this, void 0, void 0, function* () {
            const device = yield devicemanager.getDevice('AAAAA');
            chai_1.expect(device).to.not.exist;
        }));
        it('should return first discovered device when serial number is not specified', () => __awaiter(this, void 0, void 0, function* () {
            const device = yield devicemanager.getDevice();
            chai_1.expect(device.serialNumber).to.equal(mockedDevices[0].serialNumber);
        }));
        it('should return the specific attachedDevice when serial number provided', () => __awaiter(this, void 0, void 0, function* () {
            const device = yield devicemanager.getDevice(mockedDevices[1].serialNumber);
            chai_1.expect(device.serialNumber).to.equal(mockedDevices[1].serialNumber);
        }));
    });
});
//# sourceMappingURL=manager.spec.js.map