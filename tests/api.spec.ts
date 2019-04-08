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
    productName: 'Huddly IQ',
    serialNumber: '123456',
    productId: 0x21
  },
  {
    productName: 'Huddly IQ',
    serialNumber: '56789',
    productId: 0x21
  },
  {
    productName: 'Huddly GO',
    serialNumber: '534654324',
    productId: 0x11
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

    describe('for boxfish', () => {
      let trasnportstub;
      let getTransportStub;
      beforeEach(() => {
        trasnportstub = sinon.createStubInstance(NodeUsbTransport);
      });
      afterEach(() => {
        getTransportStub.restore();
      });

      it('should support device when hlink handshake succeeds', async () => {
        trasnportstub.performHlinkHandshake.returns(Promise.resolve());
        getTransportStub = sinon.stub(deviceApi, 'getTransport').returns(trasnportstub);
        const supported = await deviceApi.getValidatedTransport(mockedDevices[0]);
        expect(supported).to.be.instanceof(NodeUsbTransport);
      });

      it('should not support device when hlink handshake fails', async () => {
        trasnportstub.performHlinkHandshake.returns(Promise.reject());
        getTransportStub = sinon.stub(deviceApi, 'getTransport').returns(trasnportstub);
        const supported = await deviceApi.getValidatedTransport(mockedDevices[0]);
        expect(supported).to.equal(undefined);
      });
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
