import sinon from 'sinon';
import chai, { expect } from 'chai';
import sinonChai from 'sinon-chai';
import usb from 'usb';
import DeviceDiscoveryManager from './../src/manager';
import { EventEmitter } from 'events';
import Logger from './../src/logger';

chai.should();
chai.use(sinonChai);
chai.use(require('chai-things')).use(require('chai-as-promised'));

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

const dummyLogger = sinon.createStubInstance(Logger);

describe('HuddlyUsbDeviceManager', () => {
  let devicemanager;
  beforeEach(() => {
    sinon.stub(usb, 'getDeviceList').returns(mockedDevices);
    devicemanager = new DeviceDiscoveryManager(dummyLogger);
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

  describe('#getCacheDevice', () => {
    it('should find cached device in attachedDevices list', () => {
      devicemanager.attachedDevices.push(mockedDevices[0]);
      const cacheDevice = devicemanager.getCachedDevice(mockedDevices[0]);
      expect(cacheDevice).to.deep.equals(mockedDevices[0]);
    });
    it('should return undefined if not cached', () => {
      devicemanager.attachedDevices.push(mockedDevices[0]);
      const cacheDevice = devicemanager.getCachedDevice(mockedDevices[1]);
      expect(cacheDevice).to.equals(undefined);
    });
  });

  describe('#fetchAndPopulateDeviceParams', () => {
    it('should fetch serial number and product number from device descriptor', async () => {
      const huddlyUsbDevice = await devicemanager.fetchAndPopulateDeviceParams(mockedDevices[0]);
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

    it('should reject in case getStringDescriptor throws an error', () => {
      const mockedDev = {
        getStringDescriptor: (idx, cb) => cb('Error', undefined),
        deviceDescriptor: { iSerialNumber: 1 },
        open: () => { }
      };
      const fetchPromise = devicemanager.fetchAndPopulateDeviceParams(mockedDev);
      return fetchPromise.should.be.rejectedWith('Error');
    });

    it('should re-throw error when not able to open the device', () => {
      const buggyDevice = {
        open: () => { throw new Error('Cant open Device!'); }
      };
      const fetchPromise = devicemanager.fetchAndPopulateDeviceParams(buggyDevice);
      return fetchPromise.should.be.rejectedWith('Unable to fetch device parameters from usb descriptor! Error: Cant open Device!');
    });
  });

  describe('#setDeviceUid', () => {
    it('should generate a uid for the given device and set it to ID property', () => {
      const newDevice: any = {
        busNumber: 1,
        deviceAddress: 2,
        portNumbers: [1, 2]
      };
      devicemanager.setDeviceUid(newDevice);
      expect(newDevice.id).to.equals('46790582');
    });
  });

  describe('#isDeviceCached', () => {
    const devices = [
      { id: '123', serialNumber: 'SRL123' },
      { id: '456', serialNumber: 'SRL456' },
      { id: '789', serialNumber: 'SRL789' }
    ];
    beforeEach(() => {
      devicemanager.attachedDevices = devices;
    });

    it('should find device with matching uid', () => {
      const device = { id: '456' };
      expect(devicemanager.isDeviceCached(device)).to.equals(true);
    });
    it('should find device with matching serialNumber', () => {
      const device = { serialNumber: 'SRL789' };
      expect(devicemanager.isDeviceCached(device)).to.equals(true);
    });
    it('should return false when none of properties match', () => {
      const device = { id: '923', serialNumber: 'SRL923' };
      expect(devicemanager.isDeviceCached(device)).to.equals(false);
    });
  });

  describe('#updateCache', () => {
    const devices = [
      { id: '123', serialNumber: 'SRL123' },
      { id: '456', serialNumber: 'SRL456' },
      { id: '789', serialNumber: 'SRL789' }
    ];
    const newDevices = [
      devices[0],
      devices[1]
    ];
    const removedDevices = [
      devices[2]
    ];
    beforeEach(() => {
      devicemanager.attachedDevices.push(devices[2]);
    });
    afterEach(() => { devicemanager.attachedDevices = []; });

    it('should add all new devices to the attachedDevices list', () => {
      devicemanager.updateCache(newDevices, removedDevices);
      expect(devicemanager.attachedDevices.length).to.equals(2);
      expect(devicemanager.attachedDevices[0]).to.deep.equals(newDevices[0]);
      expect(devicemanager.attachedDevices[1]).to.deep.equals(newDevices[1]);
    });

    it('should remove all detached devices from the attachedDevices list', () => {
      devicemanager.updateCache(newDevices, removedDevices);
      expect(devicemanager.attachedDevices[0]).to.not.deep.equals(newDevices[2]);
      expect(devicemanager.attachedDevices[1]).to.not.deep.equals(newDevices[2]);
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
        devicemanager.destroy();
      });

      it('should emit USB_ATTACH when a huddly device is attached', () => {
        const attachPromise = new Promise((resolve) => {
          emitter.on('ATTACH', (device) => {
            expect(device.serialNumber).to.equal(mockedDevices[0].serialNumber);
            expect(device.productName).to.equal('Huddly IQ');
            expect(devicemanager.attachedDevices.length).to.equal(1);
            resolve();
          });
        });
        devicemanager.registerForHotplugEvents(emitter);
        attachStub.callArgWith(1, mockedDevices[0]);
        return attachPromise;
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

      it('should emit USB_DETACH with unique id if the device was not cached', () => {
        const detachPromise = new Promise((resolve) => {
          emitter.on('DETACH', (deviceId) => {
            expect(deviceId).to.equal(mockedDevices[0].id);
            resolve();
          });
        });
        devicemanager.registerForHotplugEvents(emitter);
        detachStub.callArgWith(1, mockedDevices[0]);
        return detachPromise;
      });

      it('should emit USB_DETACH with serial number when the device was cached', () => {
        devicemanager.registerForHotplugEvents(emitter);
        const cachedDevice = Object.assign({}, mockedDevices[0]);
        cachedDevice['serialNumber'] = cachedDevice.serialNumber;
        devicemanager.updateCache([cachedDevice], []);

        const detachPromise = new Promise((resolve) => {
          emitter.on('DETACH', (deviceId) => {
            expect(deviceId).to.equal(cachedDevice.serialNumber);
            resolve();
          });
        });
        detachStub.callArgWith(1, cachedDevice);
        return detachPromise;
      });

      it('should not emit USB_DETACH when other devices are detached', async () => {
        const detachSpy = sinon.spy();
        emitter.on('DETACH', detachSpy);
        devicemanager.registerForHotplugEvents(emitter);
        await detachStub.callArgWith(1, mockedDevices[2]);
        expect(detachSpy.callCount).to.equal(0);
      });
    });

    describe('on hotplug event not support', () => {
      let attachStub;
      let clock;
      beforeEach(() => {
        clock = sinon.useFakeTimers();
        attachStub = sinon.stub(usb, 'on').throws('Hotplug Events not supported!');
      });
      afterEach(() => {
        attachStub.restore();
        clock.restore();
      });
      it('should start discovery poll', () => {
        const spy = sinon.spy(devicemanager, 'discoverCameras');
        devicemanager.registerForHotplugEvents(new EventEmitter());
        clock.tick(1000);
        expect(spy.called).to.equals(true);
      });
    });
  });

  describe('#disoverCameras', () => {
    let emitter;
    let clock;
    let deviceListStub;
    beforeEach(() => {
      emitter = new EventEmitter();
      clock = sinon.useFakeTimers();
      sinon.stub(usb, 'on').throws('Hotplug Events not supported!');
      deviceListStub = sinon.stub(devicemanager, 'deviceList').resolves({
        newDevices: [
          { id: '123', serialNumber: 'SRL123'}
        ],
        removedDevices: [
          { id: '456', serialNumber: 'SRL456' }
        ]
      });
    });
    afterEach(() => {
      usb.on.restore();
      clock.restore();
      deviceListStub.restore();
      devicemanager.destroy();
    });
    it('should fire attach events for all new discovered cameras', (done) => {
      devicemanager.registerForHotplugEvents(emitter);
      emitter.on('ATTACH', (device) => {
        expect(device.serialNumber).to.equals('SRL123');
        done();
      });
      clock.tick(1500);
    });
    it('should fire detach events for all undiscovered cached cameras', (done) => {
      devicemanager.registerForHotplugEvents(emitter);
      emitter.on('DETACH', (serialNumber) => {
        expect(serialNumber).to.equals('SRL456');
        done();
      });
      clock.tick(1500);
    });
  });

  describe('#deviceList', () => {
    const detachedDevice = { id: '123', serialNumber: 'SRL123' };
    beforeEach(() => {
      /* Add device that is not returned from `usb.deviceList`.
       * This device will serve as a detached device.
      */
      devicemanager.attachedDevices.push(detachedDevice);
    });
    afterEach(() => { devicemanager.attachedDevices = []; });

    it('should update cache with new devices', async () => {
      const { devices } = await devicemanager.deviceList();
      expect(devices.length).to.equals(2);
      expect(devicemanager.attachedDevices.length).to.equal(2);
    });

    it('should return proper elements on the return object', async () => {
      const { devices, newDevices, removedDevices } = await devicemanager.deviceList();
      expect(devices.length).to.equals(2);
      expect(newDevices.length).to.equals(2);
      expect(newDevices[0]).to.deep.equals(mockedDevices[0]);
      expect(newDevices[1]).to.deep.equals(mockedDevices[1]);
      expect(removedDevices.length).to.equals(1);
      expect(removedDevices[0]).to.deep.equals(detachedDevice);
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
});
