import chai from 'chai';
import sinonChai from 'sinon-chai';
import sinon from 'sinon';
import itParam from 'mocha-param';

import NodeUsbTransport from './../src/transport';
import HuddlyDeviceAPIUSB from './../src/index';
import { EventEmitter } from 'events';
import HuddlyHEX from '@huddly/sdk-interfaces/lib/enums/HuddlyHex';
import { usb } from 'usb';

const expect = chai.expect;
chai.should();
chai.use(sinonChai);

const unsupportedMockedDevices = {
  go: {
    serialNumber: '123456',
    productId: HuddlyHEX.GO_PID
  },
  ace: {
    serialNumber: 'L123456789',
    productId: HuddlyHEX.L1_PID
  },
  base: {
    serialNumber: '1111111',
    productId: HuddlyHEX.BASE_PID
  }
};

const supportedMockedDevices = {
  boxfish: {
    serialNumber: 'B123456789',
    productId: HuddlyHEX.BOXFISH_PID
  },
  clownfish: {
    serialNumber: 'C123456789',
    productId: HuddlyHEX.CLOWNFISH_PID
  },
  dartfish: {
    serialNumber: 'D123456789',
    productId: HuddlyHEX.DARTFISH_PID
  },
  dwarfish: {
    serialNumber: 'BW123456789',
    productId: HuddlyHEX.DWARFFISH_PID
  }
};

const dummyDeviceDiscoveryManager = {
  registerForHotplugEvents: () => { },
  deviceList: () => { return supportedMockedDevices; },
  getDevice: () => { }
};

describe('HuddlyDeviceApiUSB', () => {
  let deviceApi: HuddlyDeviceAPIUSB;
  beforeEach(() => {
    deviceApi = new HuddlyDeviceAPIUSB({
      manager: dummyDeviceDiscoveryManager
    });
  });

  describe('initialize', () => {
    it('shoud call device list to instantiate discovery and emit the first attach events', () => {
      const spy = sinon.spy(deviceApi.deviceDiscoveryManager, 'deviceList');
      deviceApi.initialize();
      expect(spy.callCount).to.equal(1);
      expect(spy.getCall(0).args[0]).to.be.true;
    });
  });

  describe('#registerForHotplugEvents', () => {
    it('should initialize event emitter and register hotplug events on device manager', async () => {
      const emitter = new EventEmitter();
      const spy = sinon.spy(deviceApi.deviceDiscoveryManager, 'registerForHotplugEvents');
      expect(deviceApi.eventEmitter).to.be.undefined;
      deviceApi.registerForHotplugEvents(emitter);
      expect(deviceApi.eventEmitter).to.be.instanceof(EventEmitter);
      expect(spy.callCount).to.equal(1);
    });
  });

  describe('#getDeviceDiscoveryApi', () => {
    it('should return the device discovery manager instance', async () => {
      const deviceDiscoveryApi = await deviceApi.getDeviceDiscoveryAPI();
      expect(deviceDiscoveryApi).to.equal(dummyDeviceDiscoveryManager);
    });
  });

  describe('#getValidatedTransport', () => {
    describe('for Huddly GO', () => {
      it('should not support Huddly GO', async () => {
        const transport = await deviceApi.getValidatedTransport(unsupportedMockedDevices.go as unknown as usb.Device);
        expect(transport).to.be.undefined;
      });
    });
    describe('for Huddly L1', () => {
      it('should not support Huddly L1', async () => {
        const transport = await deviceApi.getValidatedTransport(unsupportedMockedDevices.base as unknown as usb.Device);
        expect(transport).to.be.undefined;
      });
    });

    describe('for Huddly Base', () => {
      it('should not support Huddly BASE', async () => {
        const transport = await deviceApi.getValidatedTransport(unsupportedMockedDevices.base as unknown as usb.Device);
        expect(transport).to.be.undefined;
      });
    });

    describe("boxfish variants", () => {
      let transportstub: any;
      let getTransportStub: any;
      beforeEach(() => {
        transportstub = sinon.createStubInstance(NodeUsbTransport);
      });
      afterEach(() => {
        getTransportStub.restore();
      });
      itParam("should support ${value} when hlink handshake succeeds", Object.keys(supportedMockedDevices), async (value) => {
        transportstub.performHlinkHandshake.returns(Promise.resolve());
        getTransportStub = sinon.stub(deviceApi, 'getTransport').returns(transportstub);
        const supported = await deviceApi.getValidatedTransport(supportedMockedDevices[value] as unknown as usb.Device);
        expect(supported).to.be.instanceof(NodeUsbTransport);
      });
      itParam("should not support ${value} when hlink handshake fails", Object.keys(supportedMockedDevices), async (value) => {
        transportstub.performHlinkHandshake.returns(Promise.reject());
        getTransportStub = sinon.stub(deviceApi, 'getTransport').returns(transportstub);
        const supported = await deviceApi.getValidatedTransport(supportedMockedDevices[value] as unknown as usb.Device);
        expect(supported).to.equal(undefined);
      });
    });
  });

  describe('#getTransport', () => {
    let getDeviceStub: any;
    const usbDevice: any = {
      serialNumber: 'B12344678',
      open: () => {},
      interfaces: {
        find: () => {
          return {
            claim: () => {},
            endpoints: {
              find: () => {}
            }
          }
        }
      }
    };

    beforeEach(() => {
      getDeviceStub = sinon.stub(dummyDeviceDiscoveryManager, 'getDevice').resolves(usbDevice);
    });

    afterEach(() => {
      getDeviceStub.restore();
    });

    it('should fail when the usb device is lacking serial number', async () => {
      try {
        await deviceApi.getTransport({} as unknown as usb.Device)
        expect(false).to.be.true; // It should not reach this point
      } catch (e) {
        expect(e).to.equal("Transport cannot be initialized since the provided usb device instance is lacking serial number [undefined]!");
      }
    });

    it('should initialize transport with the given device instance', async () => {
      const transport = await deviceApi.getTransport(usbDevice as unknown as usb.Device)
      expect(transport).to.be.instanceof(NodeUsbTransport);
      expect(transport.device).to.deep.equal(usbDevice);
    });

    it('should retry finding device and fail if it doesnt', async () => {
      getDeviceStub.resolves(undefined);
      try {
        await deviceApi.getTransport(usbDevice);
      } catch (e) {
        // Ok to fail
      }
      expect(getDeviceStub).to.have.callCount(10);
    });

    it('should retry max attempt times ', async () => {
      deviceApi = new HuddlyDeviceAPIUSB({
        manager: dummyDeviceDiscoveryManager,
        maxSearchRetries: 99,
      });
      getDeviceStub.resolves(undefined);
      try {
        await deviceApi.getTransport(usbDevice);
      } catch (e) {
        // Ok to fail
      }
      expect(getDeviceStub).to.have.callCount(99);
    });


    it('should retry until found ', async () => {
      deviceApi = new HuddlyDeviceAPIUSB({
        manager: dummyDeviceDiscoveryManager,
        alwaysRetry: true,
      });
      for (let i = 0; i < 77; i++) {
        getDeviceStub.onCall(i).resolves(undefined);
      }
      getDeviceStub.onCall(78).resolves(usbDevice);
      const transport = await deviceApi.getTransport(usbDevice);
      expect(getDeviceStub).to.have.callCount(78);
      expect(transport).to.be.instanceof(NodeUsbTransport);
      expect(transport.device).to.deep.equal(usbDevice);
    });
  });

  describe('#isUVCControlsSupported', () => {
    it('should not support UVC controls', async () => {
      const uvcSupport = await deviceApi.isUVCControlsSupported(supportedMockedDevices.boxfish as unknown as usb.Device);
      expect(uvcSupport).to.equal(false);
    });
  });

  describe('#getUVCControlAPIForDevice', () => {
    it('should throw error when calling getUVCControlAPIForDevice for node-usb device api', async () => {
      try {
        await deviceApi.getUVCControlAPIForDevice(supportedMockedDevices.boxfish as unknown as usb.Device);
        expect(true).to.equal(false);
      } catch (e) {
        expect(e.message).to.equal('UVCControlInterface API not available for node-usb');
      }
    });
  });

  describe('#isHIDSupported', () => {
    it('should not support HID', async () => {
      const hidSupport = await deviceApi.isHIDSupported(supportedMockedDevices.boxfish as unknown as usb.Device);
      expect(hidSupport).to.equal(false);
    });
  });

  describe('#getHIDApiForDevice', () => {
    it('should throw error when calling getHIDAPIForDevice for node-usb device api', async () => {
      try {
        await deviceApi.getHIDAPIForDevice(supportedMockedDevices.boxfish as unknown as usb.Device);
        expect(true).to.equal(false);
      } catch (e) {
        expect(e.message).to.equal('HID Unsupported for device-api usb');
      }
    });
  });
});
