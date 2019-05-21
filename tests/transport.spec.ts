import chai from 'chai';
import sinonChai from 'sinon-chai';
import NodeUsbTransport from './../src/transport';
import sinon from 'sinon';
import MessagePacket from './../src/messagepacket';
import crypto from 'crypto';
import { executionAsyncId } from 'async_hooks';

const expect = chai.expect;
chai.should();
chai.use(sinonChai);

const MAX_PACKET_SIZE = (16 * 1024);

const dummyLogger = {
  warn: (msg: string, component: string) => { },
  info: (msg: string, component: string) => { },
  debug: (msg: string, component: string) => { },
  error: (msg: string, stack: string, component: string) => { }
};


const createNewTransportInstance = () => new NodeUsbTransport({
  open: () => ({
    read: () => {},
    write: () => {},
    close: () => {},
  }),
  close: () => { },
  onDetach: () => {},
  serial: 'Serial123',
}, dummyLogger);

describe('UsbTransport', () => {
  let transport: NodeUsbTransport;
  beforeEach(() => {
    transport = createNewTransportInstance();
  });

  describe('#init', async () => {
    beforeEach(() => {
      sinon.stub(transport.device, 'close');
      sinon.stub(transport.device, 'open');
    });

    afterEach(() => {
      transport.device.open.restore();
      transport.device.close.restore();
    });

    it('should open devices', async () => {
      await transport.init();
      expect(transport.device.open).to.have.been.calledOnce;
    });

    it('should set endpoint when it is opened', async () => {
      const dummyEndpoint = {
        read: () => {},
        write: () => {},
      };
      transport.device.open.resolves(dummyEndpoint);
      await transport.init();
      expect(transport.endpoint).to.equal(dummyEndpoint);
    });

    it('should reject if it can not open device', async () => {
      transport.device.open.rejects('This failed');
      try {
        await transport.init();
      } catch (e) {
        expect(e.name).to.equal('This failed');
      }
    });
  });

  describe('#initEventLoop', () => {
    let startListenStub;
    let writeStub;
    let readStub;
    beforeEach(async () => {
      await transport.init();
      startListenStub = sinon.stub(transport, 'startListen');
      readStub = sinon.stub(transport.endpoint, 'read').returns(
        new Promise(resolves => {
          setTimeout(() => resolves(Buffer.alloc(0)), 100);
        })
      );
      writeStub = sinon.stub(transport.endpoint, 'write').returns(
        new Promise(resolves => {
          setTimeout(() => resolves(Buffer.alloc(0)), 100);
        })
      );
    });

    afterEach(async () => {
      await transport.stopEventLoop();
      readStub.restore();
      writeStub.restore();
      startListenStub.restore();
    });

    it('should start processing read and emit incoming', async () => {
      const encodedMsg = MessagePacket.createMessage('hello-msg', Buffer.from('Greetings!'));
      readStub.returns(new Promise(resolve => {
        setTimeout(() => resolve(encodedMsg), 10);
      }));
      const messagePromise = new Promise(resolves => {
        transport.on('hello-msg', resolves);
      });

      transport.initEventLoop();
      const message: any = await messagePromise;
      transport.stopEventLoop();

      expect(message.message).to.equal('hello-msg');
      expect(message.payload).to.deep.equal(Buffer.from('Greetings!'));
    });

    it('should processing write message and resolve them when sent', async () => {
      readStub.returns(new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error('LIBUSB_ERROR_TIMEOUT')), 10);
      }));
      transport.initEventLoop();
      await transport.write('dummy/cmd');
      transport.stopEventLoop();

      expect(writeStub.firstCall.args[0].toString('utf8')).to.contain('dummy/cmd');
    });

    it('should just continue if it gets timeout on read', async () => {
      readStub.returns(new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error('LIBUSB_ERROR_TIMEOUT')), 100);
      }));
      try {
        transport.initEventLoop();
      } catch (e) {
        expect('Not to fail').to.equal(e);
      }
    });

    it('should process buffer chunks when not received as a whole', async () => {
      const message = 'hello-msg';
      const payload = crypto.randomBytes(1024);
      const encodedMsg = MessagePacket.createMessage(message, payload);
      const firstChunk = encodedMsg.slice(0, encodedMsg.length / 2);
      const secondChunk = encodedMsg.slice(encodedMsg.length / 2);
      readStub.onFirstCall().resolves(firstChunk);
      readStub.onSecondCall().resolves(secondChunk);

      const emitMsgPromise = new Promise(resolve => {
        transport.on('hello-msg', resolve);
      });
      transport.initEventLoop();

      const helloMsg = await emitMsgPromise;

      expect(helloMsg).to.deep.equals(MessagePacket.parseMessage(encodedMsg));
    });

    it('should not stop event loop on error', async () => {
      readStub.returns(new Promise((resolve, reject) => {
        reject(new Error('unknown error'));
      }));
      transport.initEventLoop();

      // Let read/write async loop run
      await new Promise(resolve => setImmediate(resolve));

      expect(readStub.callCount).to.be.equal(1);
      expect(transport.running).to.equal(true);
    });

    describe('on hlink reset sequence', () => {
      it('should emit TRANSPORT_RESET if it got a empty header', async () => {
        readStub.returns(new Promise(resolve => {
          setTimeout(() => resolve(Buffer.alloc(0)), 10);
        }));
        const resetPromise = new Promise(resolve => transport.on('TRANSPORT_RESET', resolve));
        transport.initEventLoop();
        const message = await resetPromise;
        expect(message).to.be.undefined;
      });
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
    beforeEach(() => {
      onStub = sinon.stub(transport, 'once');
      this.clock = sinon.useFakeTimers();
    });

    afterEach(() => {
      onStub.restore();
      this.clock.restore();
    });

    it('should resolve `once` the message is emitted from super class', async () => {
      const msg = { name: 'hello', payload: 'hello_back' };
      onStub.callsFake((message, cb) => {
        cb(msg);
      });
      const t = await transport.receiveMessage('hello', 500);
      this.clock.tick(510);

      expect(t).to.deep.equals(msg);
    });

    it('should reject with timeout error message when timeout exceeded waiting for message to be emitted', async () => {
      const spy = sinon.spy(transport, 'removeAllListeners');
      try {
        const p = transport.receiveMessage('timeout_msg', 10);
        this.clock.tick(100);
        await p;
      } catch (e) {
        expect(transport.removeAllListeners).to.have.been.calledWith('timeout_msg');
        expect(e).to.equals('Request has timed out! timeout_msg 10');
      }
    });

    it('should resolve when message comes through, other listeners should stay intact', async () => {
      const msg = { name: 'hello', payload: 'hello_back' };
      const messageSpy = sinon.spy();
      onStub.callsFake((message, cb) => {
        cb(msg);
      });
      transport.on('test-subscribe', messageSpy);
      await transport.receiveMessage('test-subscribe', 500);
      this.clock.tick(510);

      transport.emit('test-subscribe');

      expect(messageSpy).to.have.callCount(1);
    });
  });

  describe('#read', () => {
    it('should throw error with "Deprecated" error message', async () => {
      try {
        await transport.read();
        expect(true).to.equals(false);
      } catch (e) {
        expect(e.message).to.equals('Method not supported');
      }
    });
  });

  describe('#write', () => {
    let transferStub;
    let readStub;
    beforeEach(async () => {
      await transport.init();
      transferStub = sinon.stub(transport.endpoint, 'write').returns(new Promise(resolve => {
        setTimeout(resolve, 1000);
      }));
      readStub = sinon.stub(transport.endpoint, 'read').returns(new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error('LIBUSB_ERROR_TIMEOUT')), 1000);
      }));
    });

    afterEach(async () =>  {
      transferStub.restore();
      readStub.restore();
      await transport.stopEventLoop();
    });

    it('should package the message command and its payload and call transfer', async () => {
      const writPromise = transport.write('echo-test', Buffer.alloc(0));
      transport.initEventLoop();
      await writPromise;
      expect(transferStub).to.have.calledWith(MessagePacket.createMessage('echo-test', Buffer.alloc(0)));
    });

    describe('#subscribe', () => {
      it('should send a hlink subscribe message', async () => {
        const subscribePromise = transport.subscribe('test-subscribe');
        transport.initEventLoop();
        await subscribePromise;
        expect(transferStub).to.have.calledWith(MessagePacket.createMessage('hlink-mb-subscribe', 'test-subscribe'));
      });
    });

    describe('#unsubscribe', () => {
      it('should send a hlink unsubscribe message', async () => {
        const unsubscribePromise = transport.unsubscribe('test-unsubscribe');
        transport.initEventLoop();
        await unsubscribePromise;
        expect(transferStub).to.have.calledWith(MessagePacket.createMessage('hlink-mb-unsubscribe', 'test-unsubscribe'));
      });
    });
  });

  describe('#clear', () => {
    it('should resolve', async () => {
      await transport.clear();
      expect(true).to.equal(true);
    });
  });

  describe('#close', () => {
    let transferStub;
    let readStub;
    beforeEach(async () => {
      await transport.init();
      transferStub = sinon.stub(transport.endpoint, 'write').returns(new Promise(resolve => {
        setTimeout(resolve, 10);
      }));
      readStub = sinon.stub(transport.endpoint, 'read').returns(new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error('LIBUSB_ERROR_TIMEOUT')), 10);
      }));
    });

    afterEach(() => {
      transferStub.restore();
      readStub.restore();
    });

    it('should release the vsc interface', async () => {
      await transport.init();
      const closeSpy = sinon.spy(transport.endpoint, 'close');

      await transport.close();

      expect(closeSpy.callCount).to.equal(1);
    });

    it('should call stopEventLoop', async () => {
      await transport.init();
      const stopEventLoopSpy = sinon.spy(transport, 'stopEventLoop');
      await transport.close();
      expect(stopEventLoopSpy.callCount).to.equal(1);
    });
  });

  describe('#stopEventLoop', () => {
    it('should call remove all listeners on super class', async () => {
      const removeListenersSpy = sinon.spy(transport, 'removeAllListeners');
      await transport.close();
      expect(removeListenersSpy.callCount).to.equal(1);
    });
    it('should stop poll on read endpoint', async () => {
      transport.running = true;
      await transport.init();
      await transport.close();
      expect(transport.running).to.equals(false);
    });
  });

  describe('#receive', () => {
    it('should throw error with "Deprecated" error message', async () => {
      try {
        await transport.receive();
        expect(true).to.equals(false);
      } catch (e) {
        expect(e.message).to.equals('Method not supported');
      }
    });
  });

  describe('#transfer', () => {
    let writeStub;
    beforeEach(async () => {
      await transport.init();
      writeStub = sinon.stub(transport.endpoint, 'write')
        .returns(new Promise(resolve => {
          setTimeout(resolve, 10);
        })
      );
    });

    afterEach(() => {
      writeStub.restore();
    });

    it('should transfer buffer over out endpoint', async () => {
      const messageBuffer = Buffer.from('test');
      await transport.transfer(messageBuffer);
      console.log(writeStub.callCount);
      expect(writeStub).to.have.been.calledWith(messageBuffer);
    });

    it('should fail transfer buffer when out endpoint transfer returns error', async () => {
      const messageBuffer = Buffer.from('test');
      const failedError = new Error('Failed');
      writeStub.rejects(failedError);
      try {
        await transport.transfer(messageBuffer);
        expect(true).to.be.equal(false);
      } catch (e) {
        expect(e).to.equal(failedError);
      }
    });

    it('should transfer buffer in chunks when buffer is larger than MAX_PACKET_SIZE', async () => {
      const command = 'ECHO';
      const payloadLen = (MAX_PACKET_SIZE - command.length - 16) * 2;
      const payload = crypto.randomBytes(payloadLen);
      const msg = MessagePacket.createMessage(command, payload);

      const sendChunkSpy = sinon.spy(transport, 'sendChunk');
      await transport.transfer(msg);
      expect(sendChunkSpy.callCount).to.be.equal(2);
      expect(sendChunkSpy.firstCall.args[0].length).to.equal(MAX_PACKET_SIZE);
    });
  });

  describe('#readChunk', () => {
    let readStub;
    beforeEach(async () => {
      await transport.init();
      readStub = sinon.stub(transport.endpoint, 'read');
    });

    afterEach(() => {
      readStub.restore();
    });

    it('should call transfer on out endpoint', async () => {
      readStub.resolves(MessagePacket.createMessage('test', 'test'));
      await transport.readChunk(MAX_PACKET_SIZE);
      expect(readStub).to.been.called;
      expect(readStub.firstCall.args[0]).to.be.equal(MAX_PACKET_SIZE);
    });
  });

  describe('#sendChunk', () => {
    let writeStub;
    beforeEach(async () => {
      await transport.init();
      writeStub = sinon.stub(transport.endpoint, 'write')
        .returns(new Promise(resolve => {
          setTimeout(resolve, 10);
        })
      );
    });

    afterEach(() => {
      writeStub.restore();
    });

    it('should call transfer on in endpoint', async () => {
      await transport.init();
      writeStub.resolves();
      const bufferToSend = Buffer.from('send-me');
      await transport.sendChunk(bufferToSend);
      expect(writeStub).to.been.called;
      expect(writeStub.firstCall.args[0]).to.be.equal(bufferToSend);
    });
  });

  describe('#hlink-handshake', () => {

    let writeStub;
    let readStub;
    beforeEach(async () => {
      await transport.init();
      writeStub = sinon.stub(transport.endpoint, 'write')
        .returns(new Promise(resolve => {
          setTimeout(resolve, 10);
        })
      );
      readStub = sinon.stub(transport.endpoint, 'read');
    });

    afterEach(() => {
      writeStub.restore();
      readStub.restore();
    });

    it('should correctly perform hlink salutation process', async () => {
      readStub.resolves(Buffer.from('HLink v0'));
      await transport.performHlinkHandshake();

      // Reset Sequence transfer
      expect(writeStub.callCount).to.be.equal(3);
      expect(writeStub.firstCall.args[0].compare(Buffer.from([]))).to.be.equal(0);
      expect(writeStub.secondCall.args[0].compare(Buffer.from([]))).to.be.equal(0);
      expect(writeStub.thirdCall.args[0].compare(Buffer.from([0]))).to.be.equal(0);

      // Read message
      expect(readStub.callCount).to.be.equal(1);
      expect(readStub.firstCall.args[0]).to.be.equal(1024);
    });

    it('should fail when salutation message is not "Hlink v0"', async () => {
      readStub.resolves(Buffer.from('Hlink v0000'));
      try {
        await transport.performHlinkHandshake();
        expect(true).to.equals(false);
      } catch (error) {
        expect(error).to.contain('Hlink handshake has failed!');
      }
    });
  });
});
