import chai, { expect } from 'chai';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import { usb } from 'usb';
import NodeUsbTransport from './../src/transport';
import sinon, { SinonSandbox, SinonStub } from 'sinon';
import MessagePacket from './../src/messagepacket';
import crypto, { randomBytes } from 'crypto';
import { Endpoint, InEndpoint, OutEndpoint } from 'usb/dist/usb/endpoint';

chai.should();
chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.use(require('chai-things'));

const MAX_PACKET_SIZE = (16 * 1024);

const createNewMockDevice = () => {
  return {
    serialNumber: 'B12344678',
    open: sinon.stub(),
    close: sinon.stub(),
    interfaces: [
      {
        claim:  sinon.stub(),
        release: sinon.stub(),
        descriptor: {
          bInterfaceClass: 255,
        },
        endpoints: [
          sinon.createStubInstance(InEndpoint),
          sinon.createStubInstance(OutEndpoint)
        ]
      }
    ]
  };
};

describe('UsbTransport', () => {
  let transport: NodeUsbTransport;
  let mockedDevice: any;
  beforeEach(() => {
    mockedDevice = createNewMockDevice();
    transport = new NodeUsbTransport(mockedDevice as unknown as usb.Device);
  });

  describe('#init', async () => {

    it('set in and out enpoints', async () => {
      await transport.init();
      expect(transport.inEndpoint).to.be.an.instanceof(InEndpoint);
      expect(transport.outEndpoint).to.be.an.instanceof(OutEndpoint);
      expect(transport.vscInterface).not.be.undefined;
      expect(transport.inEndpoint).not.be.undefined;
      expect(transport.outEndpoint).not.be.undefined;
    });

    it('should reject when no VSC interface is found on the device', async () => {
      const noVscInterfaceDevice = {
        open: () => { },
        close: () => { },
        interfaces: [{ descriptor: { bInterfaceClass: 25555555 } }]
      };
      transport = new NodeUsbTransport(noVscInterfaceDevice as unknown as usb.Device);
      return expect(transport.init()).to.eventually.be.rejectedWith('No VSC Interface present on the usb device!');
    });

    it.skip('should close the device when claiming interface fails', () => {
      const spy = sinon.spy(NodeUsbTransport.prototype, 'close');
      const unclaimableInterfaceDevice = {
        open: () => { },
        interfaces: [
          { claim: sinon.stub().throws({ errno: usb.LIBUSB_ERROR_BUSY, message: 'Cant claim it!' }), descriptor: { bInterfaceClass: 255 } }
        ]
      };
      transport = new NodeUsbTransport(unclaimableInterfaceDevice as unknown as usb.Device);
      return expect(transport.init()).to.eventually.be.rejectedWith('Cant claim it!').then(function () {
        spy.should.have.been.called;
      });
    });

    it('should reject with proper error message when device is occupied by a different process', () => {
      const busyDevice = {
        open: sinon.stub().throws({ errno: usb.LIBUSB_ERROR_ACCESS, message: 'Cant claim it!' })
      };
      transport = new NodeUsbTransport(busyDevice as unknown as usb.Device);
      return expect(transport.init())
      .to.eventually.be.rejectedWith('Unable to claim usb interface. Please make sure the device is not used by another process!');
    });

    it('should reject if some other error occurs when claiming the interface', () => {
      const busyDevice = {
        open: sinon.stub().throws({ errno: usb.LIBUSB_ERROR_OTHER, message: 'Cant open it!' })
      };
      transport = new NodeUsbTransport(busyDevice as unknown as usb.Device);
      return expect(transport.init())
      .to.eventually.be.rejectedWith('Cant open it!');
    });

    it('should ignore redundant calls', async () => {
      for (let step = 0; step < 10; step++) {
        await transport.init();
      }
      expect(mockedDevice.open).to.have.been.calledOnce;
    });
  });

  describe('#initEventLoop', () => {
    let startListenStub: sinon.SinonStub;
    beforeEach(async () => {
      await transport.init();
      startListenStub = sinon.stub(transport, 'startListen');
    });
    afterEach(() => {
      startListenStub.restore();
    });

    it('should start the polling on read endpoint and call #startListen', () => {
      const stub = transport.inEndpoint.startPoll as unknown as sinon.SinonStub;
      transport.initEventLoop();
      expect(stub).to.have.been.calledOnce;
      expect(stub.firstCall.args[0]).to.equal(1);
      expect(stub.firstCall.args[1]).to.equal(MAX_PACKET_SIZE);
      expect(startListenStub.callCount).to.equals(1);
    });
    it('should ignore redundent calls', () => {
      const stub = transport.inEndpoint.startPoll as unknown as sinon.SinonStub;
      for (let step = 0; step < 10; step++) {
        transport.initEventLoop();
      }
      expect(stub).to.have.been.calledOnce; // Including the call from the previous test
      expect(stub.firstCall.args[0]).to.equal(1);
      expect(stub.firstCall.args[1]).to.equal(MAX_PACKET_SIZE);
      expect(startListenStub.callCount).to.equals(1);
    });
  });

  describe('#performHlinkHandshake', () => {
    let outTransfer: sinon.SinonStub;
    let inTransfer: sinon.SinonStub;
    beforeEach(async () => {
      await transport.init();
      outTransfer = transport.outEndpoint.transfer as unknown as sinon.SinonStub;
      inTransfer = transport.inEndpoint.transfer as unknown as sinon.SinonStub;
    });
    after(() => {
      outTransfer.restore();
      inTransfer.restore();
    });

    it('should correctly perform hlink salutation process', async () => {
      outTransfer.callsFake((message, cb) => {
        cb();
      });
      inTransfer.callsFake((pkgSize, cb) => {
        cb(undefined, Buffer.from('HLink v0'));
      });
      await transport.performHlinkHandshake();

      // Reset Sequence transfer
      expect(outTransfer.callCount).to.be.equal(2);
      expect(outTransfer.firstCall.args[0].compare(Buffer.alloc(0))).to.be.equal(0);
      expect(outTransfer.secondCall.args[0].compare(Buffer.alloc(1, 0x00))).to.be.equal(0);

      // Read message
      expect(inTransfer.callCount).to.be.equal(1);
      expect(inTransfer.firstCall.args[0]).to.be.equal(1024);
    });

    it('should fail when salutation message is not "Hlink v0"', async () => {
      outTransfer.callsFake((message, cb) => {
        cb();
      });
      inTransfer.callsFake((pkgSize, cb) => {
        cb(undefined, Buffer.from('N/A'));
      });
      try {
        await transport.performHlinkHandshake();
        expect(true).to.equals(false);
      } catch (error) {
        expect(error).to.equal('Hlink handshake has failed! Wrong version. Expected HLink v0, got N/A.');
      }
    });
  });

  describe('#startListen', () => {

    it('should process incoming data and emit result', async () => {
      const encodedMsg = MessagePacket.createMessage('hello-msg', Buffer.from('Greetings!'));
      await transport.init();
      const inEndpointStub: sinon.SinonStub = transport.inEndpoint.on as unknown as sinon.SinonStub;
      inEndpointStub.withArgs('data')
        .onCall(0).callsFake((msg: String, cb: Function) => cb(encodedMsg));
      const emitSpy = sinon.spy(transport, 'emit');
      transport.startListen();
      expect(emitSpy.callCount).to.equals(1);
      expect(emitSpy.firstCall.args[0]).to.equals('hello-msg');
      expect(emitSpy.firstCall.args[1]).to.deep.equals(MessagePacket.parseMessage(encodedMsg));
    });

    it('should process buffer chunks when not received as a whole');

    it('should call #close on error message', async () => {
      const spy = sinon.spy(transport, 'close');
      await transport.init();
      const onDataStub: sinon.SinonStub = transport.inEndpoint.once as unknown as sinon.SinonStub;
      onDataStub.withArgs('error').callsFake((msg, cb) => cb('Error -1'));
      transport.startListen();
      expect(spy).to.have.been.calledOnce;
    });

    it('should remove data listener on close event', async () => {
      await transport.init();
      const removeListenerStub: sinon.SinonStub = transport.inEndpoint.removeListener as unknown as sinon.SinonStub;
      transport.startListen();
      transport.emit('CLOSED');
      expect(removeListenerStub).to.have.been.calledOnce;
      expect(removeListenerStub.getCall(0).args[0]).to.equal('data');
    });

    it('should call #close on transport error event', async () => {
      const spy = sinon.spy(transport, 'close');
      await transport.init();
      transport.startListen();
      transport.emit('ERROR', { errno: usb.LIBUSB_ERROR_INTERRUPTED });
      expect(spy).to.have.been.calledOnce;
    });
  });

  describe('#on', () => {
    it('should return an event emitter', () => {
      const on = transport.on('message', () => { });
      expect(on).to.be.instanceof(NodeUsbTransport);
    });
  });

  describe('#removeListener', () => {
    it('should return an event emitter', () => {
      const on = transport.removeListener('message', () => { });
      expect(on).to.be.instanceof(NodeUsbTransport);
    });
  });

  describe('#removeAllListeners', () => {
    it('should return an event emitter', () => {
      const on = transport.removeAllListeners('message');
      expect(on).to.be.instanceof(NodeUsbTransport);
    });
  });

  describe('#receiveMessage', () => {
    let onStub;
    let fakeTimer;
    beforeEach(() => {
      onStub = sinon.stub(transport, 'once');
      fakeTimer = sinon.useFakeTimers();
    });

    afterEach(() => {
      onStub.restore();
      fakeTimer.restore();
    });

    describe('on success', () => {
      it('should resolve `once` the message is emitted from super class', async () => {
        const msg = { name: 'hello', payload: 'hello_back' };
        onStub.callsFake((message, cb) => {
          cb(msg);
        });
        const t = await transport.receiveMessage('hello', 500);
        fakeTimer.tick(510);

        expect(t).to.deep.equals(msg);
      });

      it('should remove error message listener when main message is emitted from super class', async () => {
        const removeListenerSpy = sinon.spy(transport, 'removeListener');
        const msg = { name: 'test', payload: 'test 123' };
        onStub.callsFake((message, cb) => {
          cb(msg);
        });
        const t = await transport.receiveMessage('test', 500);
        fakeTimer.tick(510);
        expect(t).to.deep.equals(msg);
        expect(removeListenerSpy.callCount).to.equals(2);
        expect(removeListenerSpy.getCall(0).args[0]).to.equals('ERROR');
        expect(removeListenerSpy.getCall(1).args[0]).to.equals(msg.name);
      });
    });

    describe('on timeout', () => {
      it('should reject with timeout error message when timeout exceeded waiting for message to be emitted', async () => {
        const spy = sinon.spy(transport, 'removeAllListeners');
        try {
          const p = transport.receiveMessage('timeout_msg', 10);
          fakeTimer.tick(100);
          await p;
        } catch (e) {
          expect(transport.removeAllListeners).to.have.been.calledWith('timeout_msg');
          expect(e).to.equals('Request has timed out! timeout_msg 10');
          expect(spy.calledOnce).to.equals(true);
          return;
        }
        throw new Error('Did not reject receiveMessage when msg receiver times out!');
      });
    });

    describe('on error', () => {
      it('should reject with error message and clear listener on main message', async () => {
        const removeListenerSpy = sinon.spy(transport, 'removeListener');
        onStub.withArgs('ERROR').onCall(0).callsFake((msg, cb) => cb('Error Occurred!'));
        try {
          const p = transport.receiveMessage('buggy_msg', 10);
          fakeTimer.tick(100);
          await p;
        } catch (e) {
          expect(e).to.equals('Error Occurred!');
          expect(removeListenerSpy.callCount).to.equals(1);
          expect(removeListenerSpy.getCall(0).args[0]).to.equals('buggy_msg');
          return;
        }
        throw new Error('Did not reject receiveMessage when camera emits ERROR!');
      });
    });

    it('should resolve when message comes through, other listeners should stay intact', async () => {
      const msg = { name: 'hello', payload: 'hello_back' };
      const messageSpy = sinon.spy();
      onStub.callsFake((message, cb) => {
        cb(msg);
      });
      transport.on('test-subscribe', messageSpy);
      await transport.receiveMessage('test-subscribe', 500);
      fakeTimer.tick(510);

      transport.emit('test-subscribe');

      expect(messageSpy).to.have.callCount(1);
    });
  });

  describe('#write', () => {
    let transferStub;
    beforeEach(async () => {
      transferStub = sinon.stub(transport, 'transfer').returns(Promise.resolve());
      await transport.init();
    });

    afterEach(() => { transferStub.restore(); });

    it('should package the message command and its payload and call transfer', async () => {
      await transport.write('echo-test', Buffer.alloc(0));
      expect(transferStub).to.have.calledWith(MessagePacket.createMessage('echo-test', Buffer.alloc(0)));
    });

    describe('#subscribe', () => {
      it('should send a hlink subscribe message', async () => {
        await transport.subscribe('test-subscribe');
        expect(transferStub).to.have.calledWith(MessagePacket.createMessage('hlink-mb-subscribe', 'test-subscribe'));
      });
    });

    describe('#unsubscribe', () => {
      it('should send a hlink unsubscribe message', async () => {
        await transport.unsubscribe('test-unsubscribe');
        expect(transferStub).to.have.calledWith(MessagePacket.createMessage('hlink-mb-unsubscribe', 'test-unsubscribe'));
      });
    });
  });

  describe('#transfer', () => {
    let sendChunkStub: SinonStub;
    beforeEach(() => {
      sendChunkStub = sinon.stub(NodeUsbTransport.prototype, 'sendChunk');
    });
    afterEach(() => sendChunkStub.restore());

    it('should transfer buffer in chunks when buffer is larger than MAX_PACKET_SIZE', async () => {
      const command = 'ECHO';
      const payloadLen = (MAX_PACKET_SIZE - command.length - 16) * 2;
      const payload = crypto.randomBytes(payloadLen);
      const msg = MessagePacket.createMessage(command, payload);

      await transport.init();
      await transport.transfer(msg);
      expect(sendChunkStub.callCount).to.be.equal(2);
      expect(sendChunkStub.firstCall.args[0].length).to.equal(MAX_PACKET_SIZE);
    });
  });

  describe('#readChunk', () => {
    let inEndpointStub: sinon.SinonStub;
    beforeEach(async () => {
      await transport.init();
      inEndpointStub = transport.inEndpoint.transfer as unknown as sinon.SinonStub;
    });
    afterEach(() => {
      inEndpointStub.restore();
    });

    it('should call transfer on out endpoint', async () => {
      inEndpointStub.callsFake((packetsize, cb) => {
        cb();
      });
      await transport.readChunk(MAX_PACKET_SIZE);
      expect(inEndpointStub).to.been.called;
      expect(inEndpointStub.firstCall.args[0]).to.be.equal(MAX_PACKET_SIZE);
    });
    it('should reject when transfer fails', () => {
      inEndpointStub.callsFake((packetsize, cb) => {
        cb({errno: usb.LIBUSB_ERROR_OVERFLOW, message: 'OVERFLOW!'});
      });
      return expect(transport.readChunk(1))
      .to.eventually.be.rejectedWith(`Unable to read data from device (LibUSBException: ${usb.LIBUSB_ERROR_OVERFLOW})! \n OVERFLOW`);
    });
  });

  describe('#sendChunk', () => {
    let outEndpointStub: sinon.SinonStub;
    beforeEach(async () => {
      await transport.init();
      outEndpointStub = transport.outEndpoint.transfer as unknown as sinon.SinonStub;
    });
    afterEach(() => {
      outEndpointStub.restore();
    });

    it('should call transfer on in endpoint', async () => {
      outEndpointStub.callsFake((message, cb) => {
        cb();
      });
      const bufferToSend = Buffer.from('send-me');
      await transport.sendChunk(bufferToSend);
      expect(outEndpointStub).to.been.called;
      expect(outEndpointStub.firstCall.args[0]).to.be.equal(bufferToSend);
    });
    it('should reject when transfer fails', () => {
      outEndpointStub.callsFake((packetsize, cb) => {
        cb({errno: usb.LIBUSB_ERROR_OVERFLOW, message: 'OVERFLOW!'});
      });
      return expect(transport.sendChunk(Buffer.from('send-me')))
      .to.eventually.be.rejectedWith(`Unable to write data to device (LibUSBException: ${usb.LIBUSB_ERROR_OVERFLOW})! \n OVERFLOW`);
    });
  });

  describe('#stopUsbEndpointPoll', () => {
    it('should call stop poll on inEndpoint', async () => {
      await transport.init();
      const stopPolStub = transport.inEndpoint.stopPoll as unknown as sinon.SinonStub;
      stopPolStub.callsFake((cb) => { cb(); });
      return expect(transport.stopUsbEndpointPoll()).to.eventually.be.fulfilled;
    });
    it('should reject if inendpoint emits error before polling is stopped');
    it('should ignore LIBUSB_TRANSFER_NO_DEVICE since this happens on device detach');
  });

  describe('#stopEventLoop', () => {
    let removeListenerStub: SinonStub;
    let stopPoll: SinonStub;
    beforeEach(() => {
      removeListenerStub = sinon.stub(NodeUsbTransport.prototype, 'removeAllListeners');
      stopPoll = sinon.stub(NodeUsbTransport.prototype, 'stopUsbEndpointPoll');
      stopPoll.resolves();
    });
    afterEach(() => {
      removeListenerStub.restore();
      stopPoll.restore();
    });

    it('should call remove all listeners on super class', async () => {
      await transport.stopEventLoop();
      expect(removeListenerStub).to.have.been.called;
    });
    describe('stop_poll', () => {
      let startPollStub: SinonStub;
      let startListenStub: SinonStub;
      beforeEach(async () => {
        await transport.init();
        startListenStub = sinon.stub(NodeUsbTransport.prototype, 'startListen');
        startPollStub = transport.inEndpoint.startPoll as unknown as SinonStub;
        startPollStub.returns(true);
      });
      afterEach(() => {
        startListenStub.restore();
        startPollStub.restore();
      });
      it('should stop usb endpoint poll if active', async () => {
        transport.initEventLoop();
        await transport.stopEventLoop();
        expect(stopPoll).to.have.been.called;
      });
      it('should reject if #stopUsbEndpointPoll fails', async () => {
        transport.initEventLoop();
        stopPoll.rejects(new Error('Cant do that!'));
        return expect(transport.stopEventLoop()).to.eventually.be.rejectedWith('Cant do that!');
      });
    });
  });

  describe('#releaseEndpoints', () => {
    let stopPollStub: SinonStub;
    let releaseStub: SinonStub;
    beforeEach(async () => {
      await transport.init();
      stopPollStub = sinon.stub(NodeUsbTransport.prototype, 'stopUsbEndpointPoll');
      stopPollStub.resolves();
      releaseStub = transport.vscInterface.release as unknown as SinonStub;
    });
    afterEach(() => {
      stopPollStub.restore();
    });
    it('should stop endpoint poll and release the vsc interface', async () => {
      releaseStub.yields(undefined);
      await transport.releaseEndpoints();
      expect(stopPollStub).to.have.been.called;
      expect(releaseStub).to.have.been.called;
    });
    it('should reject if stopping endpoint poll fails', () => {
      stopPollStub.rejects(new Error('Uuups, problem!'));
      return expect(transport.releaseEndpoints()).to.eventually.be.rejectedWith('Uuups, problem!');
    });
    it('should ignore LIBUSB_ERROR_NO_DEVICE when releasing endpoint fails', () => {
      releaseStub.yields({ errno: usb.LIBUSB_ERROR_NO_DEVICE});
      return expect(transport.releaseEndpoints()).to.eventually.be.fulfilled;
    });
    it('should reject for any other libusb errors thrown on endpoint release', () => {
      releaseStub.yields({ errno: usb.LIBUSB_ERROR_ACCESS, message: 'Device is busy!'});
      return expect(transport.releaseEndpoints()).to.eventually.be.rejectedWith('Unable to release vsc interface! UsbError: -3 \nDevice is busy!');
    });
  });

  describe('#close', () => {
    let releaseEndpointStub: SinonStub;
    beforeEach(async () => {
      await transport.init();
      releaseEndpointStub = sinon.stub(NodeUsbTransport.prototype, 'releaseEndpoints');
      releaseEndpointStub.resolves();
    });
    afterEach(() => {
      releaseEndpointStub.restore();
    });
    it('should release endpoints', async () => {
      await transport.close();
      expect(releaseEndpointStub).to.have.been.calledOnce;
    });
    it('should attempt to close device', async () => {
      await transport.close();
      expect(mockedDevice.close).to.have.been.calledOnce;
    });
    it('should emit closed event', async () => {
      const spy = sinon.spy();
      transport.on('CLOSED', spy);
      await transport.close();
      expect(spy).to.have.been.calledOnce;
    });
    it('should assume closed regardless if close fails', () => {
      // Tihs is the case where we want to close a device that is detached/booted
      mockedDevice.close.throws(new Error('Pending transfers......'));
      return expect(transport.close()).to.eventually.be.fulfilled;
    });
    it('should reject if releasing endpoints fails', () => {
      releaseEndpointStub.rejects(new Error('Undefined'));
      return expect(transport.close()).to.eventually.be.rejectedWith('Undefined');
    });
  });

  describe('#depricated', () => {
    describe('#receive', () => {
      it('should not be supported', () => expect(transport.receive).to.throw('Method "receive" is no longer supported! Please use "receiveMessage" instead.'));
    });
    describe('#read', () => {
      it('should not be supported', () => expect(transport.read).to.throw('Method "read" is no longer supported! Please use "receiveMessage" instead.'));
    });
  });

  describe('#clear', () => {
    it('should resolve', async () => {
      await transport.clear();
      expect(true).to.equal(true);
    });
  });
});