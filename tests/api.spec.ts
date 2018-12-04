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
    productName: "Huddly IQ",
    serialNumber: "123456"
  },
  {
    productName: "Huddly IQ",
    serialNumber: "56789"
  },
];

const dummyLogger = {
  warn: () => { },
  info: () => { },
  error: () => { }
};

const dummyDeviceDiscoveryManager = {
  registerForHotplugEvents: () => { },
  deviceList: () => { return mockedDevices; },
  getDevice: () => { }
}

describe('HuddlyDeviceApiUSB', () => {
  let deviceApi: HuddlyDeviceAPIUSB;
  beforeEach(() => {
    deviceApi = new HuddlyDeviceAPIUSB(dummyLogger, '', dummyDeviceDiscoveryManager);
  });

  describe('#initialize', () => {
    it('should fetch all devices and emit attach events', async () => {
      const emitter = new EventEmitter();
      await deviceApi.registerForHotplugEvents(emitter);
      const attachSpy = sinon.spy();
      emitter.on('ATTACH', attachSpy);
      await deviceApi.initialize();
      expect(attachSpy.callCount).to.equal(2);
      expect(attachSpy.firstCall.args[0]).to.deep.equal(mockedDevices[0]);
      expect(attachSpy.secondCall.args[0]).to.deep.equal(mockedDevices[1]);
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
    })
  });

  describe('#getDeviceDiscoveryApi', () => {
    it('should return the device discovery manager instance', async () => {
      const deviceDiscoveryApi = await deviceApi.getDeviceDiscoveryAPI();
      expect(deviceDiscoveryApi).to.equal(dummyDeviceDiscoveryManager);
    })
  });

  describe('#getValidatedTransport', () => {
    let trasnportstub;
    let getTransportStub;
    beforeEach(() => {
      trasnportstub = sinon.createStubInstance(NodeUsbTransport);
    });
    afterEach(() => {
      getTransportStub.restore();
    })
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
