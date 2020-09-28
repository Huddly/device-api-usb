import chai from 'chai';
import sinonChai from 'sinon-chai';
import sinon from 'sinon';
import sleep from 'await-sleep';

import { BulkUsbSingleton } from './../src/bulkusbdevice';

const expect = chai.expect;
chai.should();
chai.use(sinonChai);

const dummyCpp = {
  openDevice: sinon.stub(),
  listDevice: sinon.stub(),
  listDevices: sinon.stub(),
};

describe('BulkUsbDeviceSingleton', () => {
  let bulkusbSingleton;
  beforeEach(() => {
    bulkusbSingleton = new BulkUsbSingleton(dummyCpp);
  });

  afterEach(() => {
    bulkusbSingleton.stop();
  });

  describe('#listDevice', () => {
    beforeEach(() => {
      dummyCpp.listDevices.yields([
        {
          vid: 0x21,
          pid: 0x21,
          serial: 'serial-3',
          cookie: 3,
        },
        {
          vid: 0x21,
          pid: 0x21,
          serial: 'serial-2',
          cookie: 2,
        },
        {
          vid: 0x21,
          pid: 0x21,
          serial: 'serial-1',
          cookie: 1,
        }
      ]);
    });

    it('should return a list of all available Huddly devices', async () => {
      const devices = await bulkusbSingleton.listDevices();
      expect(devices).to.have.length(3);
      expect(devices[0].serialNumber).to.be.equal('serial-3');
      expect(devices[1].serialNumber).to.be.equal('serial-2');
      expect(devices[2].serialNumber).to.be.equal('serial-1');
    });
  });

  describe('#onAttach', () => {
    beforeEach(async () => {
      dummyCpp.listDevices.yields([
        {
          vid: 0x21,
          pid: 0x21,
          serial: 'serial-4',
          cookie: 4,
        },
      ]);
    });


    it('should emit attach for all new devices', async () => {
      const attachSpy = sinon.spy();
      bulkusbSingleton.onAttach(attachSpy);
      await sleep(502);
      expect(attachSpy).to.have.been.calledOnce;
    });

    it('should not emit attach event if device is already seen', async () => {
      const attachSpy = sinon.spy();
      bulkusbSingleton.onAttach(attachSpy);
      // Two list loops
      await sleep(251);
      await sleep(251);
      expect(attachSpy).to.have.callCount(1);
    });
  });

  describe('device #onDetach', () => {
    beforeEach(() => {
      dummyCpp.listDevices.yields([
        {
          vid: 0x21,
          pid: 0x21,
          serial: 'serial-4',
          cookie: 4,
        },
      ]);
    });
    it('should emit onDetach callback if device is no longer in list', async () => {
      const detachSpy = sinon.spy();
      bulkusbSingleton.onAttach(d => {
        d.onDetach(detachSpy);
      });
      // Two list loops
      await sleep(251);
      dummyCpp.listDevices.yields([
      ]);
      await sleep(251);
      expect(detachSpy).to.have.been.calledOnce;
    });

    it('should not emit onDetach cb if device is still in the list', async () => {
      const detachSpy = sinon.spy();
      bulkusbSingleton.onAttach(d => {
        d.onDetach(detachSpy);
      });
      // Two list loops
      await sleep(251);
      await sleep(251);
      expect(detachSpy).to.have.callCount(0);
    });
  });
});
