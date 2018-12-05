import sinon from 'sinon';
import chai, { expect } from 'chai';
import sinonChai from 'sinon-chai';
import usb from 'usb';
import DeviceDiscoveryManager from './../src/manager';
import { EventEmitter } from 'events';

chai.should();
chai.use(sinonChai);

const mockedDevices = [
  {
    getStringDescriptor: (idx, cb) => {
      if (idx === 1)
        cb(undefined, '4D000042');
      else
        cb(undefined, 'Huddly IQ');
    },
    deviceDescriptor: {
      idVendor: 0x2bd9,
      idProduct: 0x21,
      iSerialNumber: 1,
      iProduct: 2,
    },
    busNumber: 1,
    deviceAddress: 2,
    portNumbers: [1, 2],
    interfaces: [],
    open: () => { },
    close: () => { },
    serialNumber: '4D000042',
    id: '46790582'
  },
  {
    getStringDescriptor: (idx, cb) => {
      if (idx === 1)
        cb(undefined, '4D000043');
      else
        cb(undefined, 'Huddly IQ');
    },
    deviceDescriptor: {
      idVendor: 0x2bd9,
      idProduct: 0x21,
      iSerialNumber: 1,
      iProduct: 2,
    },
    busNumber: 1,
    deviceAddress: 2,
    portNumbers: [1, 3],
    interfaces: [],
    open: () => { },
    close: () => { },
    serialNumber: '4D000043'
  },
  { // Not a Huddly IQ device
    getStringDescriptor: (idx, cb) => {
      if (idx === 1)
        cb(undefined, 'ABCDSF');
      else
        cb(undefined, 'Non Huddly Device');
    },
    deviceDescriptor: {
      idVendor: 0x2bd1,
      idProduct: 0x22,
      iSerialNumber: 1,
      iProduct: 2,
    },
    busNumber: 3,
    deviceAddress: 2,
    portNumbers: [1, 3],
    open: () => { },
    close: () => { },
    serialNumber: 'ABCDSF'
  }
];
describe('HuddlyUsbDeviceManager', () => {
  let devicemanager;
  beforeEach(() => {
    sinon.stub(usb, 'getDeviceList').returns(mockedDevices);
    devicemanager = new DeviceDiscoveryManager();
  });

  afterEach(() => {
    usb.getDeviceList.restore();
  });

  describe('#generateUsbUniqueId', () => {
    it('should generate a unique id based on device descriptor properties', () => {
      const deviceOneHash = devicemanager.generateUsbUniqueId({
        usbBusNumber: mockedDevices[0].busNumber,
        usbDeviceAddress: mockedDevices[0].deviceAddress,
        usbPortNumbers: mockedDevices[0].portNumbers
      });
      expect(deviceOneHash).to.equal(mockedDevices[0].id);
    });
  });

  describe('#registerForHotplugEvents', () => {
    describe('#onAttach', () => {
      let emitter;
      let attachStub;
      beforeEach(() => {
        emitter = new EventEmitter();
        attachStub = sinon.stub(usb, 'on').withArgs('attach');
      });

      afterEach(() => {
        usb.on.restore();
      });

      it('should emit USB_ATTACH when a huddly device is attached', async () => {
        const attachSpy = sinon.spy();
        emitter.on('ATTACH', attachSpy);
        devicemanager.registerForHotplugEvents(emitter);
        await attachStub.callArgWith(1, mockedDevices[0]);
        expect(attachSpy.callCount).to.equal(1);
        expect(attachSpy.firstCall.args[0].serialNumber).to.equal(mockedDevices[0].serialNumber);
        expect(attachSpy.firstCall.args[0].productName).to.equal('Huddly IQ');
        expect(devicemanager.attachedDevices.length).to.equal(1);
      });

      it('should not emit USB_ATTACH when other devices are attached', async () => {
        const attachSpy = sinon.spy();
        emitter.on('ATTACH', attachSpy);
        devicemanager.registerForHotplugEvents(emitter);
        await attachStub.callArgWith(1, mockedDevices[2]);
        expect(attachSpy.callCount).to.equal(0);
        expect(devicemanager.attachedDevices.length).to.equal(0);
      });
    });

    describe('#onDetach', () => {
      let emitter;
      let detachStub;
      beforeEach(() => {
        emitter = new EventEmitter();
        detachStub = sinon.stub(usb, 'on').withArgs('detach');
      });

      afterEach(() => {
        usb.on.restore();
      });

      it('should emit USB_DETACH with unique id if the device was not cached', async () => {
        const detachSpy = sinon.spy();
        emitter.on('DETACH', detachSpy);
        devicemanager.registerForHotplugEvents(emitter);
        await detachStub.callArgWith(1, mockedDevices[0]);
        expect(detachSpy.callCount).to.equal(1);
        expect(detachSpy.firstCall.args[0]).to.equal(mockedDevices[0].id);
      });

      it('should emit USB_DETACH with serial number when the device was cached', async () => {
        const detachSpy = sinon.spy();
        emitter.on('DETACH', detachSpy);
        devicemanager.registerForHotplugEvents(emitter);
        const cachedDevice = Object.assign({}, mockedDevices[0]);
        cachedDevice['serialNumber'] = cachedDevice.serialNumber;
        devicemanager.cacheUsbDevice(cachedDevice);
        await detachStub.callArgWith(1, cachedDevice);
        expect(detachSpy.callCount).to.equal(1);
        expect(detachSpy.firstCall.args[0]).to.equal(cachedDevice.serialNumber);
      });

      it('should not emit USB_DETACH when other devices are detached', async () => {
        const detachSpy = sinon.spy();
        emitter.on('DETACH', detachSpy);
        devicemanager.registerForHotplugEvents(emitter);
        await detachStub.callArgWith(1, mockedDevices[2]);
        expect(detachSpy.callCount).to.equal(0);
      });
    });
  });

  describe('#deviceList', () => {
    it('should discover all huddly devices', async () => {
      const devices = await devicemanager.deviceList();
      expect(devices.length).to.equals(2);
      expect(devicemanager.attachedDevices.length).to.equal(2);
    });
  });

  describe('#getDevice', () => {
    it('should return null when serial does not exist', async () => {
      const device = await devicemanager.getDevice('AAAAA');
      expect(device).to.not.exist;
    });

    it('should return first discovered device when serial number is not specified', async () => {
      const device = await devicemanager.getDevice();
      expect(device.serialNumber).to.equal(mockedDevices[0].serialNumber);
    });

    it('should return the specific attachedDevice when serial number provided', async () => {
      const device = await devicemanager.getDevice(mockedDevices[1].serialNumber);
      expect(device.serialNumber).to.equal(mockedDevices[1].serialNumber);
    });
  });

  describe('#fetchAndPopulateDevieParams', () => {
    it('should fetch serial number and product number from device descriptor', async () => {
      const huddlyUsbDevice = await devicemanager.fetchAndPopulateDevieParams(mockedDevices[0]);
      const generatedId = devicemanager.generateUsbUniqueId({
        usbBusNumber: mockedDevices[0].busNumber,
        usbDeviceAddress: mockedDevices[0].deviceAddress,
        usbPortNumbers: mockedDevices[0].portNumbers
      });
      expect(huddlyUsbDevice.id).to.equal(generatedId);
      expect(huddlyUsbDevice.serialNumber).to.equal(mockedDevices[0].serialNumber);
      expect(huddlyUsbDevice.productName).to.equal('Huddly IQ');
      expect(huddlyUsbDevice.productId).to.equal(mockedDevices[0].deviceDescriptor.idProduct);
      expect(huddlyUsbDevice.vendorId).to.equal(mockedDevices[0].deviceDescriptor.idVendor);
    });

    it('should reject in case getStringDescriptor throws an error', async () => {
      const mockedDev = {
        getStringDescriptor: (idx, cb) => cb('Error', undefined),
        deviceDescriptor: { iSerialNumber: 1 },
        open: () => { }
      };
      try {
        await devicemanager.fetchAndPopulateDevieParams(mockedDev);
        expect(true).to.equal(false);
      } catch (e) {
        expect(e).to.equal('Error');
      }
    });
  });

  describe('#cacheUsbDevice', () => {
    it('should add device to attachedDevices list if it doesnt exist', () => {
      expect(devicemanager.attachedDevices.length).to.equal(0);
      devicemanager.cacheUsbDevice(mockedDevices[0]);
      expect(devicemanager.attachedDevices.length).to.equal(1);
      expect(devicemanager.attachedDevices[0]).to.deep.equal({
        id: mockedDevices[0].id,
        serialNumber: mockedDevices[0].serialNumber
      });
    });

    it('should not add same device twice on attachedDevices', () => {
      devicemanager.cacheUsbDevice(mockedDevices[0]);
      expect(devicemanager.attachedDevices.length).to.equal(1);
      devicemanager.cacheUsbDevice(mockedDevices[0]);
      expect(devicemanager.attachedDevices.length).to.equal(1);
    });
  });
});
