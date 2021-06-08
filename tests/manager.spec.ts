import sinon from 'sinon';
import chai, { expect } from 'chai';
import sinonChai from 'sinon-chai';
import BulkUsb from './../src/bulkusbdevice';
import DeviceDiscoveryManager from './../src/manager';
import { EventEmitter } from 'events';
import Logger from '@huddly/sdk/lib/src/utilitis/logger';
import { doesNotReject } from 'assert';

chai.should();
chai.use(sinonChai);
chai.use(require('chai-things')).use(require('chai-as-promised'));

const mockedDevices = [
  {
      vid: 11225,
      pid: 33,
      serialNumber: 'B40I00070',
      location: [ 0, 2 ],
      onDetach: sinon.stub(),
      equals: sinon.stub(),
      id: '',
  },
  {
    vid: 11225,
    pid: 33,
    serialNumber: 'B40I09970',
    location: [ 4, 6 ],
    onDetach: sinon.stub(),
    equals: sinon.stub(),
    id: '',
  },
  {
    vid: 0x2bd1,
    pid: 0x22,
    serialNumber: 'ABCDSF',
    location: [ 1, 3 ],
    onDetach: sinon.stub(),
    equals: sinon.stub(),
    id: '',
  }
];

const dummyLogger = sinon.createStubInstance(Logger);

describe('HuddlyUsbDeviceManager', () => {
  let devicemanager;
  beforeEach(() => {
    devicemanager = new DeviceDiscoveryManager(dummyLogger);
  });

  afterEach(() => {
  });

  describe('#registerForHotplugEvents', () => {
    describe('#onAttach', () => {
      let emitter;
      let attachStub;
      beforeEach(() => {
        emitter = new EventEmitter();
        attachStub = sinon.stub(BulkUsb, 'onAttach');
      });

      afterEach(() => {
        attachStub.restore();
        devicemanager.destroy();
      });

      it('should emit USB_ATTACH when a huddly device is attached', (): Promise<any> => {
        const attachPromise = new Promise((resolve: any) => {
          emitter.on('ATTACH', (device) => {
            expect(device.serialNumber).to.equal(mockedDevices[0].serialNumber);
            resolve();
          });
        });
        devicemanager.registerForHotplugEvents(emitter);
        attachStub.callArgWith(0, mockedDevices[0]);
        return attachPromise;
      });

      it('should not emit USB_ATTACH when other devices are attached', async () => {
        const attachSpy = sinon.spy();
        emitter.on('ATTACH', attachSpy);
        devicemanager.registerForHotplugEvents(emitter);
        await attachStub.callArgWith(0, mockedDevices[2]);
        expect(attachSpy.callCount).to.equal(0);
        expect(devicemanager.attachedDevices.length).to.equal(0);
      });
    });

    describe('#onDetach', () => {
      let emitter;
      let attachStub;
      beforeEach(() => {
        emitter = new EventEmitter();
        attachStub = sinon.stub(BulkUsb, 'onAttach');
      });

      afterEach(() => {
        attachStub.restore();
      });

      it('should emit USB_DETACH with serial', () => {
        const detachPromise = new Promise((resolve: any) => {
          emitter.on('DETACH', (deviceId) => {
            expect(deviceId).to.equal(mockedDevices[0].serialNumber);
            resolve();
          });
        });
        devicemanager.registerForHotplugEvents(emitter);
        attachStub.callArgWith(0, mockedDevices[0]);
        mockedDevices[0].onDetach.callArgWith(0, mockedDevices[0]);
        return detachPromise;
      });

      it('should not emit USB_DETACH when other devices are detached', async () => {
        const detachSpy = sinon.spy();
        emitter.on('DETACH', detachSpy);
        devicemanager.registerForHotplugEvents(emitter);
        await attachStub.callArgWith(0, mockedDevices[2]);
        mockedDevices[0].onDetach.callArgWith(0, mockedDevices[2]);
        expect(detachSpy.callCount).to.equal(0);
      });

      it('should remove list from attached devices', async () => {
        const detachSpy = sinon.spy();
        emitter.on('DETACH', detachSpy);
        devicemanager.registerForHotplugEvents(emitter);
        await attachStub.callArgWith(0, mockedDevices[2]);
        mockedDevices[0].onDetach.callArgWith(0, mockedDevices[2]);
        expect(devicemanager.attachedDevices.length).to.be.equal(0);
      });
    });
  });

  describe('#disoverCameras', () => {
    let emitter;
    let attachStub;
    beforeEach(() => {
      emitter = new EventEmitter();
      attachStub = sinon.stub(BulkUsb, 'onAttach');
    });

    afterEach(() => {
      attachStub.restore();
      devicemanager.destroy();
    });

    it('should fire attach events for all new discovered cameras', (done) => {
      emitter.on('ATTACH', (d) => {
        expect(d.serialNumber).to.equals('SRL123');
        done();
      });
      devicemanager.registerForHotplugEvents(emitter);
      attachStub.callArgWith(0, { id: '123', serialNumber: 'SRL123', pid: 0x21, vid: devicemanager.HUDDLY_VID, onDetach: () => {}});
    });

    it('should fire detach events for all undiscovered cached cameras', (done) => {
      emitter.on('DETACH', (serial) => {
        expect(serial).to.equals('SRL456');
        done();
      });
      devicemanager.registerForHotplugEvents(emitter);
      attachStub.callArgWith(0, { id: '123', serialNumber: 'SRL123', pid: 0x21, vid: devicemanager.HUDDLY_VID, onDetach: (cb) => {
        cb({ id: '456', serialNumber: 'SRL456', pid: 0x21, vid: devicemanager.HUDDLY_VID });
      }});

    });
  });

  describe('#deviceList', () => {
    let listDeviceStub;
    beforeEach(() => {
      /* Add device that is not returned from `usb.deviceList`.
      * This device will serve as a detached device.
      */
      listDeviceStub = sinon.stub(BulkUsb, 'listDevices').resolves([
        { id: '123', serialNumber: 'SRL123', pid: 0x21, vid: devicemanager.HUDDLY_VID, onDetach: (cb) => {} },
      ]);
    });

    afterEach(() => {
      listDeviceStub.restore();
    });

    it('list devices', async () => {
      const { devices } = await devicemanager.deviceList();
      expect(devices[0].serialNumber).to.equals('SRL123');
    });
  });

  describe('#getDevice', () => {
    let listDeviceStub;
    beforeEach(() => {
      /* Add device that is not returned from `usb.deviceList`.
      * This device will serve as a detached device.
      */
      devicemanager.registerForHotplugEvents(new EventEmitter());
      listDeviceStub = sinon.stub(BulkUsb, 'listDevices').resolves(mockedDevices);
    });

    afterEach(() => {
      listDeviceStub.restore();
    });

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
