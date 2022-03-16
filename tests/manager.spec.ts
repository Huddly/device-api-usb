import sinon from 'sinon';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised'
import itParam from 'mocha-param';
import sinonChai from 'sinon-chai';
import { usb } from 'usb';
import DeviceDiscoveryManager, { UsbDevice } from './../src/manager';
import { EventEmitter } from 'events';
import HuddlyHEX from '@huddly/sdk-interfaces/lib/enums/HuddlyHex';

chai.should();
chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.use(require('chai-things'));

const mockedDevices = [
  {
    getStringDescriptor: (idx: Number, cb: Function) => {
      if (idx === 1)
        cb(undefined, '4D000042');
      else
        cb(undefined, 'Huddly IQ');
    },
    deviceDescriptor: {
      idVendor: HuddlyHEX.VID,
      idProduct: HuddlyHEX.BOXFISH_PID,
      iSerialNumber: 1,
      iProduct: 2,
    },
    busNumber: 1,
    deviceAddress: 2,
    portNumbers: [1, 2],
    interfaces: [],
    open: () => { },
    close: () => { },
    serialNumber: '',
    id: '',
    productName: '',
    productId: undefined,
    vendorId: undefined
  },
  {
    getStringDescriptor: (idx: Number, cb: Function) => {
      if (idx === 1)
        cb(undefined, '4D000043');
      else
        cb(undefined, 'Huddly IQ');
    },
    deviceDescriptor: {
      idVendor: HuddlyHEX.VID,
      idProduct: HuddlyHEX.BOXFISH_PID,
      iSerialNumber: 1,
      iProduct: 2,
    },
    busNumber: 1,
    deviceAddress: 2,
    portNumbers: [1, 3],
    interfaces: [],
    open: () => { },
    close: () => { },
    serialNumber: '',
    id: '',
    productName: '',
    productId: undefined,
    vendorId: undefined
  },
  { // Not a Huddly IQ device
    getStringDescriptor: (idx: Number, cb: Function) => {
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
  let usbDeviceListStub: any;
  let devicemanager: DeviceDiscoveryManager;
  beforeEach(() => {
    const bar = (): usb.Device[] => {
      console.log("bar");
      return mockedDevices as unknown as usb.Device[]
    };
    usbDeviceListStub = sinon.stub(DeviceDiscoveryManager.prototype, 'getUnfilteredDeviceList');
    usbDeviceListStub.returns(mockedDevices as unknown as usb.Device[]);
    devicemanager = new DeviceDiscoveryManager();
  });

  afterEach(() => {
    usbDeviceListStub.restore();
  });

  describe('#generateUsbUniqueId', () => {
    it('should generate a unique id based on device descriptor properties', () => {
      const deviceOneHash = devicemanager.generateUsbUniqueId({
        usbBusNumber: mockedDevices[0].busNumber,
        usbDeviceAddress: mockedDevices[0].deviceAddress,
        usbPortNumbers: mockedDevices[0].portNumbers
      });
      expect(deviceOneHash).to.equal('46790582');
    });
  });

  describe('#getDeviceUUID', () => {
    it('should find cached device in attachedDevices list', () => {
      const uuid = devicemanager.getDeviceUUID(mockedDevices[0] as unknown as usb.Device);
      expect(uuid).to.equals('46790582');
    });
  });

  describe('#fetchAndPopulateDeviceParams', () => {
    it('should fetch serial number and product number from device descriptor', async () => {
      const DUT: usb.Device = mockedDevices[0] as unknown as usb.Device;
      await devicemanager.fetchAndPopulateDeviceParams(DUT);
      const generatedId = devicemanager.generateUsbUniqueId({
        usbBusNumber: DUT.busNumber,
        usbDeviceAddress: DUT.deviceAddress,
        usbPortNumbers: DUT.portNumbers
      });
      expect(mockedDevices[0].id).to.equal(generatedId);
      expect(mockedDevices[0].serialNumber).to.equal('4D000042');
      expect(mockedDevices[0].productName).to.equal('Huddly IQ');
      expect(mockedDevices[0].productId).to.equal(DUT.deviceDescriptor.idProduct);
      expect(mockedDevices[0].vendorId).to.equal(DUT.deviceDescriptor.idVendor);
    });

    it('should reject in case getStringDescriptor throws an error', () => {
      const mockedDev = {
        getStringDescriptor: (idx: Number, cb: Function) => cb('Ooops, you cant do this!', undefined),
        deviceDescriptor: { iSerialNumber: 1 },
        open: () => { }
      };
      const fetchPromise = devicemanager.fetchAndPopulateDeviceParams(mockedDev as unknown as usb.Device);
      return expect(fetchPromise).to.eventually.be.rejectedWith('Ooops, you cant do this!');
    });

    describe("allowed access errors", () => {
      itParam("should return false when libusb error_no  ${value} is thrown on open/claim", [usb.LIBUSB_ERROR_ACCESS, usb.LIBUSB_ERROR_BUSY], async (value) => {
        const busyDevice = {
          open: () => { throw { errno: value } }
        };
        const deviceParamsFetched = devicemanager.fetchAndPopulateDeviceParams(busyDevice as unknown as usb.Device);
        expect(deviceParamsFetched).to.eventually.be.false;
      });
    });
    describe("other access errors", () => {
      const unwantedErrors: Number[] = [usb.LIBUSB_ERROR_IO, usb.LIBUSB_ERROR_INVALID_PARAM, usb.LIBUSB_ERROR_NO_DEVICE, usb.LIBUSB_ERROR_NOT_FOUND, usb.LIBUSB_ERROR_TIMEOUT, usb.LIBUSB_ERROR_NOT_SUPPORTED, usb.LIBUSB_ERROR_OTHER];
      itParam("should re-throw when libusb error_no ${value} is thrown on open/claim", unwantedErrors, async (value) => {
        const busyDevice = {
          open: () => { throw { errno: value } }
        };
        const deviceParamsFetched = devicemanager.fetchAndPopulateDeviceParams(busyDevice as unknown as usb.Device);
        expect(deviceParamsFetched).to.eventually.be.false;
      });
    });
  });

  describe('#registerForHotplugEvents', () => {
    describe('#onAttach', () => {
      let emitter: EventEmitter;
      beforeEach(() => {
        emitter = new EventEmitter();
      });

      it('should emit USB_ATTACH when a huddly device is attached', () => {
        const attachPromise = new Promise<void>((resolve) => {
          emitter.on('ATTACH', (device) => {
            expect(device.serialNumber).to.equal(mockedDevices[0].serialNumber);
            expect(device.productName).to.equal('Huddly IQ');
            expect(devicemanager.cachedDevices.length).to.equal(1);
            resolve()
          });
        });
        devicemanager.registerForHotplugEvents(emitter);
        usb.emit('attach', mockedDevices[0] as unknown as usb.Device)
        return attachPromise;
      });

      it('should not emit USB_ATTACH when other devices are attached', async () => {
        const attachSpy = sinon.spy();
        emitter.on('ATTACH', attachSpy);
        devicemanager.registerForHotplugEvents(emitter);
        usb.emit('attach', mockedDevices[2] as unknown as usb.Device)
        expect(attachSpy.callCount).to.equal(0);
        expect(devicemanager.cachedDevices.length).to.equal(0);
      });

      it('should not call #fetchAndPopulateDeviceParams for non-huddly devices', async () => {
        const spy = sinon.spy(devicemanager, 'fetchAndPopulateDeviceParams');
        devicemanager.registerForHotplugEvents(emitter);
        usb.emit('attach', mockedDevices[2] as unknown as usb.Device);
        expect(spy.callCount).to.equal(0);
      });
    });

    describe('#onDetach', () => {
      let emitter = new EventEmitter();

      it('should emit USB_DETACH with unique id if the device was not cached', () => {
        const detachPromise = new Promise<void>((resolve) => {
          emitter.on('DETACH', (deviceId: usb.Device) => {
            expect((deviceId as unknown as UsbDevice).serialNumber).to.equal(mockedDevices[0].serialNumber);
            resolve();
          });
        });
        devicemanager.registerForHotplugEvents(emitter);
        usb.emit('detach', mockedDevices[0] as unknown as usb.Device)
        return detachPromise;
      });

      it('should not emit USB_DETACH when other devices are detached', async () => {
        const detachSpy = sinon.spy();
        emitter.on('DETACH', detachSpy);
        devicemanager.registerForHotplugEvents(emitter);
        usb.emit('detach', mockedDevices[2] as unknown as usb.Device)
        expect(detachSpy.callCount).to.equal(0);
      });
    });
  });

  describe('#deviceList', () => {
    it('should only return the huddly devices with fetched parameters', async () => {
      const devices: usb.Device[] = await devicemanager.deviceList();
      expect(devices.length).to.equal(2);
      // 1st device
      expect((devices[0] as unknown as UsbDevice).serialNumber).to.equal('4D000042');
      expect((devices[0] as unknown as UsbDevice).id).to.equal('46790582');
      expect((devices[0] as unknown as UsbDevice).productName).to.equal('Huddly IQ');
      expect((devices[0] as unknown as UsbDevice).productId).to.equal(HuddlyHEX.BOXFISH_PID);
      expect((devices[0] as unknown as UsbDevice).vendorId).to.equal(HuddlyHEX.VID);
      // 2nd device
      expect((devices[1] as unknown as UsbDevice).serialNumber).to.equal('4D000043');
      expect((devices[1] as unknown as UsbDevice).id).to.equal('46790583');
      expect((devices[1] as unknown as UsbDevice).productName).to.equal('Huddly IQ');
      expect((devices[1] as unknown as UsbDevice).productId).to.equal(HuddlyHEX.BOXFISH_PID);
      expect((devices[1] as unknown as UsbDevice).vendorId).to.equal(HuddlyHEX.VID);
    });

    it('should update cache with new devices', async () => {
      const devices: usb.Device[] = await devicemanager.deviceList();
      expect(devices.length).to.equals(2);
      expect(devicemanager.cachedDevices.length).to.equal(2);
    });
  });

  describe('#getDevice', () => {
    it('should return null when serial does not exist', async () => {
      const device = await devicemanager.getDevice('AAAAA');
      expect(device).to.not.exist;
    });

    it('should return first discovered device when serial number is not specified', async () => {
      const device = await devicemanager.getDevice();
      expect((device as unknown as UsbDevice).serialNumber).to.equal(mockedDevices[0].serialNumber);
    });

    it('should return the specific attachedDevice when serial number provided', async () => {
      const device = await devicemanager.getDevice(mockedDevices[1].serialNumber);
      expect((device as unknown as UsbDevice).serialNumber).to.equal(mockedDevices[1].serialNumber);
    });
  });
});