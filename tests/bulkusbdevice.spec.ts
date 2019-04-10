import chai from 'chai';
import sinonChai from 'sinon-chai';
import sinon from 'sinon';

import { BulkUsbDevice } from './../src/bulkusbdevice';
import BulkUsbEndpoint from './../src/bulkusbendpoint';

const expect = chai.expect;
chai.should();
chai.use(sinonChai);

const dummyCpp = {
  openDevice: sinon.stub(),
  listDevice: sinon.stub(),
};

describe('BulkUsbDevice', () => {
  let device: BulkUsbDevice;
  beforeEach(() => {
    device = new BulkUsbDevice(dummyCpp, {
      vid: 0x21,
      pid: 0x21,
    });
  });

  describe('#open', () => {
    beforeEach(() => {
      dummyCpp.openDevice.yields({});
    });

    it('should return a new endpoint device on open', async () => {
      const endpoint = await device.open();
      expect(endpoint).to.be.instanceof(BulkUsbEndpoint);
    });

    it('should reject if does not return a handle', async () => {
      dummyCpp.openDevice.yields(-1);
      try {
        const endpoint = await device.open();
        expect(true).to.be.equal(false);
      } catch (e) {
        expect(e.message).to.equal('LIBUSB_ERROR_IO');
      }
    });
  });

  describe('#equals', () => {
    it('should be true if cookies are the same', () => {
      const firstDevice = new BulkUsbDevice(dummyCpp, {
        vid: 0x21,
        pid: 0x21,
        cookie: 1,
      });

      const secondDevice = new BulkUsbDevice(dummyCpp, {
        vid: 0x21,
        pid: 0x21,
        cookie: 1,
      });

      expect(firstDevice.equals(secondDevice)).to.be.equal(true);
    });

    it('should not be true if cookies are different', () => {
      const firstDevice = new BulkUsbDevice(dummyCpp, {
        vid: 0x21,
        pid: 0x21,
        cookie: 1,
      });

      const secondDevice = new BulkUsbDevice(dummyCpp, {
        vid: 0x21,
        pid: 0x21,
        cookie: 2,
      });

      expect(firstDevice.equals(secondDevice)).to.be.equal(false);
    });
  });
});
