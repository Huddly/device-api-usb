import chai from 'chai';
import sinonChai from 'sinon-chai';
import usb from 'usb';
import NodeUsbTransport from './../src/transport';
import sinon from 'sinon';
import MessagePacket from './../src/messagepacket';
import crypto from 'crypto';

const expect = chai.expect;
chai.should();
chai.use(sinonChai);

const MAX_PACKET_SIZE = (16 * 1024);

const dummyLogger = {
  warn: () => { },
  info: () => { },
  error: () => { }
};
const createNewTransportInstance = () => new NodeUsbTransport({
  open: () => { },
  close: () => { },
  interfaces: [
    {
      claim: () => { },
      release: (endpoints, cb) => {
        cb(undefined);
      },
      descriptor: {
        bInterfaceClass: 255,
      },
      endpoints: [
        sinon.createStubInstance(usb.InEndpoint),
        sinon.createStubInstance(usb.OutEndpoint)
      ]
    }
  ],
  serial: 'Serial123',
}, dummyLogger);

describe('UsbTransport', () => {
  let transport: NodeUsbTransport;
  beforeEach(() => {
    transport = createNewTransportInstance();
  });

  // describe('#init', async () => {
  //   let closeStub;
  //   beforeEach(() => {
  //     closeStub = sinon.stub(transport, 'closeDevice');
  //   });
  //   afterEach(() => { closeStub.restore(); });

  //   it('set in and out enpoints', async () => {
  //     await transport.init();
  //     expect(transport.inEndpoint).to.be.an.instanceof(usb.InEndpoint);
  //     expect(transport.outEndpoint).to.be.an.instanceof(usb.OutEndpoint);
  //     expect(transport.inEndpoint.address).not.be.null;
  //     expect(transport.outEndpoint.address).not.be.null;
  //   });

  //   it('should reject when no VSC interface is found on the device', async () => {
  //     const noVscInterfaceDevice = {
  //       open: () => { },
  //       close: () => { },
  //       interfaces: [{ descriptor: { bInterfaceClass: 25555555 } }]
  //     };
  //     try {
  //       transport = new NodeUsbTransport(noVscInterfaceDevice, dummyLogger);
  //       await transport.init();
  //       expect(true).to.equals(false);
  //     } catch (e) {
  //       expect(e).to.equal('No VSC Interface present on the usb device!');
  //     }
  //   });

  //   it('should reject when claiminig the interface fails', async () => {
  //     const buggyDevice = {
  //       open: () => { },
  //       close: () => { },
  //       interfaces: [{
  //         descriptor: { bInterfaceClass: 255 },
  //         claim: () => { throw new Error('Cannot claim this interface!'); },
  //       }]
  //     };
  //     try {
  //       transport = new NodeUsbTransport(buggyDevice, dummyLogger);
  //       await transport.init();
  //     } catch (e) {
  //       expect(e).to.equal('Error Occurred claiming interface! Error: Cannot claim this interface!');
  //     }
  //   });
  // });

  // describe('#initEventLoop', () => {
  //   let startListenStub;
  //   beforeEach(async () => {
  //     await transport.init();
  //     startListenStub = sinon.stub(transport, 'startListen');
  //   });
  //   afterEach(() => {
  //     startListenStub.restore();
  //   });

  //   it('should start the polling on read endpoint and call #startListen', () => {
  //     transport.initEventLoop();
  //     expect(transport.inEndpoint.startPoll.callCount).to.equals(1);
  //     expect(transport.inEndpoint.startPoll.firstCall.args[0]).to.equals(1);
  //     expect(transport.inEndpoint.startPoll.firstCall.args[1]).to.equals(MAX_PACKET_SIZE);
  //     expect(startListenStub.callCount).to.equals(1);
  //     expect(transport.running).to.equals(true);
  //   });
  // });

  // describe('#startListen', () => {
  //   let closeStub;
  //   beforeEach(() => {
  //     closeStub = sinon.stub(transport, 'close');
  //   });
  //   afterEach(() => closeStub.restore());

  //   it('should process incoming data and emit result', async () => {
  //     const encodedMsg = MessagePacket.createMessage('hello-msg', Buffer.from('Greetings!'));
  //     await transport.init();
  //     transport.inEndpoint.on.withArgs('data')
  //       .onCall(0).callsFake((msg, cb) => cb(encodedMsg));
  //     const emitSpy = sinon.spy(transport, 'emit');
  //     transport.startListen();
  //     expect(emitSpy.callCount).to.equals(1);
  //     expect(emitSpy.firstCall.args[0]).to.equals('hello-msg');
  //     expect(emitSpy.firstCall.args[1]).to.deep.equals(MessagePacket.parseMessage(encodedMsg));
  //   });

  //   it.skip('should process buffer chunks when not received as a whole', async () => {
  //     const message = 'hello-msg';
  //     const payload = crypto.randomBytes(1024);
  //     const encodedMsg = MessagePacket.createMessage(message, payload);
  //     const firstChunk = encodedMsg.slice(0, encodedMsg.length / 2);
  //     const secondChunk = encodedMsg.slice(encodedMsg.length / 2);
  //     await transport.init();
  //     transport.inEndpoint.on.withArgs('data').callsFake((msg, cb) => cb(firstChunk));
  //     setTimeout(() => {
  //       transport.inEndpoint.on.withArgs('data').callsFake((msg, cb) => {
  //         console.log('---- Second call');
  //         cb(secondChunk);
  //       });
  //     }, 100);
  //     const emitSpy = sinon.spy(transport, 'emit');
  //     transport.startListen();
  //     expect(emitSpy.callCount).to.equals(1);
  //     expect(emitSpy.firstCall.args[0]).to.equals('hello-msg');
  //     expect(emitSpy.firstCall.args[1]).to.deep.equals(MessagePacket.parseMessage(encodedMsg));
  //   });

  //   it('should call #close on error message', async () => {
  //     await transport.init();
  //     transport.inEndpoint.on.withArgs('error').onCall(0).callsFake((msg, cb) => cb('Error -1'));
  //     transport.startListen();
  //     expect(closeStub.callCount).to.equals(1);
  //   });

  //   describe('on hlink reset sequence', () => {
  //     it('should throw an error and close connection', async () => {
  //       let resolveReset;
  //       const resetPromise = new Promise(resolve => resolveReset = resolve);
  //       await transport.init();
  //       transport.inEndpoint.on.withArgs('data').callsFake((msg, cb) => cb(Buffer.from('HLink v0')));
  //       transport.inEndpoint.stopPoll.resolves({});
  //       transport.on('TRANSPORT_RESET', resolveReset);
  //       await transport.startListen();

  //       await resetPromise;
  //       expect(closeStub.callCount).to.equals(1);
  //     });
  //   });
  // });

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
        expect(e).to.equals('Request has timed out!');
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
    it('should throw error with "Depricated" error message', async () => {
      try {
        await transport.read();
        expect(true).to.equals(false);
      } catch (e) {
        expect(e.message).to.equals('Depricated Method!');
      }
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

  describe('#clear', () => {
    it('should resolve', async () => {
      await transport.clear();
      expect(true).to.equal(true);
    });
  });

  describe('#close', () => {
    it('should release the vsc interface', async () => {
      await transport.init();
      const releaseSpy = sinon.spy(transport.vscInterface, 'release');
      const closeSpy = sinon.spy(transport.device, 'close');
      await transport.close();

      expect(releaseSpy.callCount).to.equal(1);
      // expect(releaseSpy.firstCall.args[0]).to.deep.equal([transport.inEndpoint, transport.outEndpoint]);
      expect(closeSpy.callCount).to.equal(1);
    });

    it('should call stopEventLoop', async () => {
      await transport.init();
      const stopEventLoopSpy = sinon.spy(transport, 'stopEventLoop');
      await transport.close();
      expect(stopEventLoopSpy.callCount).to.equal(1);
    });
  });

  // describe('#stopEventLoop', () => {
  //   it('should call remove all listeners on super class', async () => {
  //     const removeListenersSpy = sinon.spy(transport, 'removeAllListeners');
  //     await transport.close();
  //     expect(removeListenersSpy.callCount).to.equal(1);
  //   });
  //   it('should stop poll on read endpoint', async () => {
  //     transport.running = true;
  //     await transport.init();
  //     transport.inEndpoint.stopPoll.callsFake((cb) => cb());
  //     await transport.close();
  //     expect(transport.inEndpoint.stopPoll.callCount).to.equals(1);
  //   });
  // });

  describe('#receive', () => {
    it('should throw error with "Depricated" error message', async () => {
      try {
        await transport.receive();
        expect(true).to.equals(false);
      } catch (e) {
        expect(e.message).to.equals('Depricated Method!');
      }
    });
  });

  // describe('#transfer', () => {
  //   let outEndpointStub;
  //   beforeEach(async () => {
  //     await transport.init();
  //     outEndpointStub = transport.outEndpoint.transfer;
  //   });

  //   it('should transfer buffer over out endpoint', async () => {
  //     const messageBuffer = Buffer.from('test');
  //     outEndpointStub.callsFake((message, cb) => {
  //       cb();
  //     });
  //     await transport.transfer(messageBuffer);
  //     expect(outEndpointStub).to.have.been.calledWith(messageBuffer);
  //   });

  //   it('should fail transfer buffer when out endpoint transfer returns error', async () => {
  //     const messageBuffer = Buffer.from('test');
  //     outEndpointStub.callsFake((message, cb) => {
  //       cb('error');
  //     });
  //     try {
  //       await transport.transfer(messageBuffer);
  //       expect(true).to.be.equal(false);
  //     } catch (e) {
  //       expect(e).to.equal('Transfer failed! error');
  //     }
  //   });

  //   it('should transfer buffer in chunks when buffer is larger than MAX_PACKET_SIZE', async () => {
  //     const command = 'ECHO';
  //     const payloadLen = (MAX_PACKET_SIZE - command.length - 16) * 2;
  //     const payload = crypto.randomBytes(payloadLen);
  //     const msg = MessagePacket.createMessage(command, payload);

  //     outEndpointStub.callsFake((message, cb) => {
  //       cb();
  //     });

  //     const sendChunkSpy = sinon.spy(transport, 'sendChunk');
  //     await transport.transfer(msg);
  //     expect(sendChunkSpy.callCount).to.be.equal(2);
  //     expect(sendChunkSpy.firstCall.args[0].length).to.equal(MAX_PACKET_SIZE);
  //   });
  // });

  // describe('#readChunk', () => {
  //   it('should call transfer on out endpoint', async () => {
  //     await transport.init();
  //     transport.inEndpoint.transfer.callsFake((packetsize, cb) => {
  //       cb();
  //     });
  //     await transport.readChunk(MAX_PACKET_SIZE);
  //     expect(transport.inEndpoint.transfer).to.been.called;
  //     expect(transport.inEndpoint.transfer.firstCall.args[0]).to.be.equal(MAX_PACKET_SIZE);
  //   });
  // });

  // describe('#sendChunk', () => {
  //   it('should call transfer on in endpoint', async () => {
  //     await transport.init();
  //     transport.outEndpoint.transfer.callsFake((message, cb) => {
  //       cb();
  //     });
  //     const bufferToSend = Buffer.from('send-me');
  //     await transport.sendChunk(bufferToSend);
  //     expect(transport.outEndpoint.transfer).to.been.called;
  //     expect(transport.outEndpoint.transfer.firstCall.args[0]).to.be.equal(bufferToSend);
  //   });

  //   it('should clearHalrt on endpoint when receiving a LIBUSB_ERROR_PIPE', async () => {
  //     await transport.init();
  //     transport.outEndpoint.transfer.callsFake((chunk, cb) => cb({ error: 'LIBUSB_ERROR_PIPE', errno: usb.LIBUSB_ERROR_PIPE }));
  //     transport.outEndpoint.clearHalt.callsFake((cb) => cb());
  //     try {
  //       await transport.sendChunk(Buffer.from('send-me'));
  //       expect(true).to.equals(false);
  //     } catch (e) {
  //       expect(e).to.equals('Clear halt failed on out endpoint!');
  //       expect(transport.outEndpoint.clearHalt.callCount).to.equals(1);
  //     }
  //   });
  // });

  // describe('#hlink-handshake', () => {
  //   beforeEach(async () => {
  //     await transport.init();
  //   });

  //   it('should correctly perform hlink salutation process', async () => {
  //     transport.outEndpoint.transfer.callsFake((message, cb) => {
  //       cb();
  //     });
  //     transport.inEndpoint.transfer.callsFake((pkgSize, cb) => {
  //       cb(undefined, Buffer.from('HLink v0'));
  //     });
  //     await transport.performHlinkHandshake();

  //     // Reset Sequence transfer
  //     expect(transport.outEndpoint.transfer.callCount).to.be.equal(2);
  //     expect(transport.outEndpoint.transfer.firstCall.args[0].compare(Buffer.alloc(0))).to.be.equal(0);
  //     expect(transport.outEndpoint.transfer.secondCall.args[0].compare(Buffer.alloc(1, 0x00))).to.be.equal(0);

  //     // Read message
  //     expect(transport.inEndpoint.transfer.callCount).to.be.equal(1);
  //     expect(transport.inEndpoint.transfer.firstCall.args[0]).to.be.equal(1024);
  //   });

  //   it('should fail when salutation message is not "Hlink v0"', async () => {
  //     transport.outEndpoint.transfer.callsFake((message, cb) => {
  //       cb();
  //     });
  //     transport.inEndpoint.transfer.callsFake((pkgSize, cb) => {
  //       cb(undefined, Buffer.from('Hlink v0000'));
  //     });
  //     try {
  //       await transport.performHlinkHandshake();
  //       expect(true).to.equals(false);
  //     } catch (error) {
  //       expect(error).to.equal('HLink handshake mechanism failed! Wrong version!');
  //     }
  //   });
  // });
});
