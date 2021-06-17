import chai from 'chai';
import sinonChai from 'sinon-chai';
import sinon from 'sinon';

import NodeUsbTransport from './../src/transport';
import HuddlyDeviceAPIUSB from './../src/index';
import { EventEmitter } from 'events';

const expect = chai.expect;
chai.should();
chai.use(sinonChai);

const mockedDevices = [
  {
    serialNumber: '123456',
    productId: 0x21
  },
  {
    serialNumber: '56789',
    productId: 0x21
  },
  {
    serialNumber: '534654324',
    productId: 0x11
  },
  {
    serialNumber: '534654324',
    productId: 3e9
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
  let deviceApi: HuddlyDeviceAPIUSB;
  beforeEach(() => {
    deviceApi = new HuddlyDeviceAPIUSB({
      logger: dummyLogger,
      manager: dummyDeviceDiscoveryManager
    });
  });

  describe('#registerForHotplugEvents', () => {
    it('should initialize event emitter and register hotplug events on device manager', async () => {
      const emitter = new EventEmitter();
      const spy = sinon.spy(deviceApi.deviceDiscoveryManager, 'registerForHotplugEvents');
      expect(deviceApi.eventEmitter).to.be.undefined;
      await deviceApi.registerForHotplugEvents(emitter);
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
    describe('for huddly go', () => {
      it('should not support huddly go devices', async () => {
        const transport = await deviceApi.getValidatedTransport(mockedDevices[2]);
        expect(transport).to.be.undefined;
      });
    });
    describe('for huddly l1', () => {
      it('should not support huddly l1 devices', async () => {
        const transport = await deviceApi.getValidatedTransport(mockedDevices[3]);
        expect(transport).to.be.undefined;
      });
    });


    describe('for boxfish', () => {
      let transportstub;
      let getTransportStub;
      beforeEach(() => {
        transportstub = sinon.createStubInstance(NodeUsbTransport);
      });
      afterEach(() => {
        getTransportStub.restore();
      });

      it('should support device when hlink handshake succeeds', async () => {
        transportstub.performHlinkHandshake.returns(Promise.resolve());
        getTransportStub = sinon.stub(deviceApi, 'getTransport').returns(transportstub);
        const supported = await deviceApi.getValidatedTransport(mockedDevices[0]);
        expect(supported).to.be.instanceof(NodeUsbTransport);
      });

      it('should not support device when hlink handshake fails', async () => {
        transportstub.performHlinkHandshake.returns(Promise.reject());
        getTransportStub = sinon.stub(deviceApi, 'getTransport').returns(transportstub);
        const supported = await deviceApi.getValidatedTransport(mockedDevices[0]);
        expect(supported).to.equal(undefined);
      });
    });
  });

  describe('#getTransport', () => {
    let getDeviceStub;
    beforeEach(() => {
      getDeviceStub = sinon.stub(dummyDeviceDiscoveryManager, 'getDevice').resolves({
        open: () => {},
      });
    });

    afterEach(() => {
      getDeviceStub.restore();
    });

    it('should get create a NodeUSBTransport for when serialNumber matches', async () => {
      const transport = await deviceApi.getTransport(mockedDevices[0]);
      expect(transport).to.be.instanceof(NodeUsbTransport);
    });

    it('should retry to find device if it cant find a matching device the first time', async () => {
      getDeviceStub.resolves(undefined);
      try {
        await deviceApi.getTransport(mockedDevices[0]);
      } catch (e) {
        // Ok to fail
      }
      expect(getDeviceStub).to.have.callCount(10);
    });

    it('should retry max attempt times ', async () => {
      deviceApi = new HuddlyDeviceAPIUSB({
        logger: dummyLogger,
        manager: dummyDeviceDiscoveryManager,
        maxSearchRetries: 99,
      });
      getDeviceStub.resolves(undefined);
      try {
        await deviceApi.getTransport(mockedDevices[0]);
      } catch (e) {
        // Ok to fail
      }
      expect(getDeviceStub).to.have.callCount(99);
    });


    it('should retry until found ', async () => {
      deviceApi = new HuddlyDeviceAPIUSB({
        logger: dummyLogger,
        manager: dummyDeviceDiscoveryManager,
        alwaysRetry: true,
      });
      for (let i = 0; i < 77; i++) {
        getDeviceStub.onCall(i).resolves(undefined);
      }
      getDeviceStub.onCall(78).resolves({
        open: () => {},
      });
      try {
        await deviceApi.getTransport(mockedDevices[0]);
      } catch (e) {
        // Ok to fail
      }
      expect(getDeviceStub).to.have.callCount(78);
    });
  });

  describe('#isUVCControlsSupported', () => {
    it('should not support UVC controls', async () => {
      const uvcSupport = await deviceApi.isUVCControlsSupported(mockedDevices[0]);
      expect(uvcSupport).to.equal(false);
    });
  });

  describe('#getUVCControlAPIForDevice', () => {
    it('should throw error when calling getUVCControlAPIForDevice for node-usb device api', async () => {
      try {
        await deviceApi.getUVCControlAPIForDevice(mockedDevices[0]);
        expect(true).to.equal(false);
      } catch (e) {
        expect(e.message).to.equal('UVCControlInterface API not available for node-usb');
      }
    });
  });

  describe('#isHIDSupported', () => {
    it('should not support HID', async () => {
      const hidSupport = await deviceApi.isHIDSupported(mockedDevices[0]);
      expect(hidSupport).to.equal(false);
    });
  });

  describe('#getHIDApiForDevice', () => {
    it('should throw error when calling getHIDAPIForDevice for node-usb device api', async () => {
      try {
        await deviceApi.getHIDAPIForDevice(mockedDevices[0]);
        expect(true).to.equal(false);
      } catch (e) {
        expect(e.message).to.equal('HID Unsupported for device-api usb');
      }
    });
  });
});
