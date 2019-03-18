"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = __importDefault(require("chai"));
const sinon_chai_1 = __importDefault(require("sinon-chai"));
const transport_1 = __importDefault(require("./../src/transport"));
const sinon_1 = __importDefault(require("sinon"));
const messagepacket_1 = __importDefault(require("./../src/messagepacket"));
const crypto_1 = __importDefault(require("crypto"));
const expect = chai_1.default.expect;
chai_1.default.should();
chai_1.default.use(sinon_chai_1.default);
const MAX_PACKET_SIZE = (16 * 1024);
const dummyLogger = {
    warn: () => { },
    info: () => { },
    error: () => { }
};
const createNewTransportInstance = () => new transport_1.default({
    open: () => ({
        read: () => { },
        write: () => { },
        close: () => { },
    }),
    close: () => { },
    onDetach: () => { },
    serial: 'Serial123',
}, dummyLogger);
describe('UsbTransport', () => {
    let transport;
    beforeEach(() => {
        transport = createNewTransportInstance();
    });
    describe('#init', () => __awaiter(this, void 0, void 0, function* () {
        beforeEach(() => {
            sinon_1.default.stub(transport.device, 'close');
            sinon_1.default.stub(transport.device, 'open');
        });
        afterEach(() => {
            transport.device.open.restore();
            transport.device.close.restore();
        });
        it('should open devices', () => __awaiter(this, void 0, void 0, function* () {
            yield transport.init();
            expect(transport.device.open).to.have.been.calledOnce;
        }));
        it('should set endpoint when it is opened', () => __awaiter(this, void 0, void 0, function* () {
            const dummyEndpoint = {
                read: () => { },
                write: () => { },
            };
            transport.device.open.resolves(dummyEndpoint);
            yield transport.init();
            expect(transport.endpoint).to.equal(dummyEndpoint);
        }));
        it('should reject if it can not open device', () => __awaiter(this, void 0, void 0, function* () {
            transport.device.open.rejects('This failed');
            try {
                yield transport.init();
            }
            catch (e) {
                expect(e.name).to.equal('This failed');
            }
        }));
    }));
    describe('#initEventLoop', () => {
        let startListenStub;
        let writeStub;
        let readStub;
        beforeEach(() => __awaiter(this, void 0, void 0, function* () {
            yield transport.init();
            startListenStub = sinon_1.default.stub(transport, 'startListen');
            readStub = sinon_1.default.stub(transport.endpoint, 'read').returns(new Promise(resolves => {
                setTimeout(() => resolves(Buffer.alloc(0)), 100);
            }));
            writeStub = sinon_1.default.stub(transport.endpoint, 'write').returns(new Promise(resolves => {
                setTimeout(() => resolves(Buffer.alloc(0)), 100);
            }));
        }));
        afterEach(() => __awaiter(this, void 0, void 0, function* () {
            yield transport.stopEventLoop();
            readStub.restore();
            writeStub.restore();
            startListenStub.restore();
        }));
        it('should start processing read and emit incoming', () => __awaiter(this, void 0, void 0, function* () {
            const encodedMsg = messagepacket_1.default.createMessage('hello-msg', Buffer.from('Greetings!'));
            readStub.returns(new Promise(resolve => {
                setTimeout(() => resolve(encodedMsg), 10);
            }));
            const messagePromise = new Promise(resolves => {
                transport.on('hello-msg', resolves);
            });
            transport.initEventLoop();
            const message = yield messagePromise;
            transport.stopEventLoop();
            expect(message.message).to.equal('hello-msg');
            expect(message.payload).to.deep.equal(Buffer.from('Greetings!'));
        }));
        it('should processing write message and resolve them when sent', () => __awaiter(this, void 0, void 0, function* () {
            readStub.returns(new Promise((resolve, reject) => {
                setTimeout(() => reject(new Error('LIBUSB_ERROR_TIMEOUT')), 10);
            }));
            transport.initEventLoop();
            yield transport.write('dummy/cmd');
            transport.stopEventLoop();
            expect(writeStub.firstCall.args[0].toString('utf8')).to.contain('dummy/cmd');
        }));
        it('should just continue if it gets timeout on read', () => __awaiter(this, void 0, void 0, function* () {
            readStub.returns(new Promise((resolve, reject) => {
                setTimeout(() => reject(new Error('LIBUSB_ERROR_TIMEOUT')), 100);
            }));
            try {
                transport.initEventLoop();
            }
            catch (e) {
                expect('Not to fail').to.equal(e);
            }
        }));
        it('should process buffer chunks when not received as a whole', () => __awaiter(this, void 0, void 0, function* () {
            const message = 'hello-msg';
            const payload = crypto_1.default.randomBytes(1024);
            const encodedMsg = messagepacket_1.default.createMessage(message, payload);
            const firstChunk = encodedMsg.slice(0, encodedMsg.length / 2);
            const secondChunk = encodedMsg.slice(encodedMsg.length / 2);
            readStub.onFirstCall().resolves(firstChunk);
            readStub.onSecondCall().resolves(secondChunk);
            const emitMsgPromise = new Promise(resolve => {
                transport.on('hello-msg', resolve);
            });
            transport.initEventLoop();
            const helloMsg = yield emitMsgPromise;
            expect(helloMsg).to.deep.equals(messagepacket_1.default.parseMessage(encodedMsg));
        }));
        it('should not stop event loop on error', () => __awaiter(this, void 0, void 0, function* () {
            readStub.returns(new Promise((resolve, reject) => {
                reject(new Error('unknown error'));
            }));
            transport.initEventLoop();
            // Let read/write async loop run
            yield new Promise(resolve => setImmediate(resolve));
            expect(readStub.callCount).to.be.equal(1);
            expect(transport.running).to.equal(true);
        }));
        describe('on hlink reset sequence', () => {
            it('should emit TRANSPORT_RESET if it got a empty header', () => __awaiter(this, void 0, void 0, function* () {
                readStub.returns(new Promise(resolve => {
                    setTimeout(() => resolve(Buffer.alloc(0)), 10);
                }));
                const resetPromise = new Promise(resolve => transport.on('TRANSPORT_RESET', resolve));
                transport.initEventLoop();
                const message = yield resetPromise;
                expect(message).to.be.undefined;
            }));
        });
    });
    describe('#on', () => {
        it('should return an event emitter', () => {
            const on = transport.on('message', () => { });
            expect(on).to.be.instanceof(transport_1.default);
        });
    });
    describe('#removeListener', () => {
        it('should return an event emitter', () => {
            const on = transport.removeListener('message', () => { });
            expect(on).to.be.instanceof(transport_1.default);
        });
    });
    describe('#removeAllListeners', () => {
        it('should return an event emitter', () => {
            const on = transport.removeAllListeners('message');
            expect(on).to.be.instanceof(transport_1.default);
        });
    });
    describe('#receiveMessage', () => {
        let onStub;
        beforeEach(() => {
            onStub = sinon_1.default.stub(transport, 'once');
            this.clock = sinon_1.default.useFakeTimers();
        });
        afterEach(() => {
            onStub.restore();
            this.clock.restore();
        });
        it('should resolve `once` the message is emitted from super class', () => __awaiter(this, void 0, void 0, function* () {
            const msg = { name: 'hello', payload: 'hello_back' };
            onStub.callsFake((message, cb) => {
                cb(msg);
            });
            const t = yield transport.receiveMessage('hello', 500);
            this.clock.tick(510);
            expect(t).to.deep.equals(msg);
        }));
        it('should reject with timeout error message when timeout exceeded waiting for message to be emitted', () => __awaiter(this, void 0, void 0, function* () {
            const spy = sinon_1.default.spy(transport, 'removeAllListeners');
            try {
                const p = transport.receiveMessage('timeout_msg', 10);
                this.clock.tick(100);
                yield p;
            }
            catch (e) {
                expect(transport.removeAllListeners).to.have.been.calledWith('timeout_msg');
                expect(e).to.equals('Request has timed out! timeout_msg 10');
            }
        }));
        it('should resolve when message comes through, other listeners should stay intact', () => __awaiter(this, void 0, void 0, function* () {
            const msg = { name: 'hello', payload: 'hello_back' };
            const messageSpy = sinon_1.default.spy();
            onStub.callsFake((message, cb) => {
                cb(msg);
            });
            transport.on('test-subscribe', messageSpy);
            yield transport.receiveMessage('test-subscribe', 500);
            this.clock.tick(510);
            transport.emit('test-subscribe');
            expect(messageSpy).to.have.callCount(1);
        }));
    });
    describe('#read', () => {
        it('should throw error with "Deprecated" error message', () => __awaiter(this, void 0, void 0, function* () {
            try {
                yield transport.read();
                expect(true).to.equals(false);
            }
            catch (e) {
                expect(e.message).to.equals('Deprecated Method!');
            }
        }));
    });
    describe('#write', () => {
        let transferStub;
        let readStub;
        beforeEach(() => __awaiter(this, void 0, void 0, function* () {
            yield transport.init();
            transferStub = sinon_1.default.stub(transport.endpoint, 'write').returns(new Promise(resolve => {
                setTimeout(resolve, 1000);
            }));
            readStub = sinon_1.default.stub(transport.endpoint, 'read').returns(new Promise((resolve, reject) => {
                setTimeout(() => reject(new Error('LIBUSB_ERROR_TIMEOUT')), 1000);
            }));
        }));
        afterEach(() => __awaiter(this, void 0, void 0, function* () {
            transferStub.restore();
            readStub.restore();
            yield transport.stopEventLoop();
        }));
        it('should package the message command and its payload and call transfer', () => __awaiter(this, void 0, void 0, function* () {
            const writPromise = transport.write('echo-test', Buffer.alloc(0));
            transport.initEventLoop();
            yield writPromise;
            expect(transferStub).to.have.calledWith(messagepacket_1.default.createMessage('echo-test', Buffer.alloc(0)));
        }));
        describe('#subscribe', () => {
            it('should send a hlink subscribe message', () => __awaiter(this, void 0, void 0, function* () {
                const subscribePromise = transport.subscribe('test-subscribe');
                transport.initEventLoop();
                yield subscribePromise;
                expect(transferStub).to.have.calledWith(messagepacket_1.default.createMessage('hlink-mb-subscribe', 'test-subscribe'));
            }));
        });
        describe('#unsubscribe', () => {
            it('should send a hlink unsubscribe message', () => __awaiter(this, void 0, void 0, function* () {
                const unsubscribePromise = transport.unsubscribe('test-unsubscribe');
                transport.initEventLoop();
                yield unsubscribePromise;
                expect(transferStub).to.have.calledWith(messagepacket_1.default.createMessage('hlink-mb-unsubscribe', 'test-unsubscribe'));
            }));
        });
    });
    describe('#clear', () => {
        it('should resolve', () => __awaiter(this, void 0, void 0, function* () {
            yield transport.clear();
            expect(true).to.equal(true);
        }));
    });
    describe('#close', () => {
        let transferStub;
        let readStub;
        beforeEach(() => __awaiter(this, void 0, void 0, function* () {
            yield transport.init();
            transferStub = sinon_1.default.stub(transport.endpoint, 'write').returns(new Promise(resolve => {
                setTimeout(resolve, 10);
            }));
            readStub = sinon_1.default.stub(transport.endpoint, 'read').returns(new Promise((resolve, reject) => {
                setTimeout(() => reject(new Error('LIBUSB_ERROR_TIMEOUT')), 10);
            }));
        }));
        afterEach(() => {
            transferStub.restore();
            readStub.restore();
        });
        it('should release the vsc interface', () => __awaiter(this, void 0, void 0, function* () {
            yield transport.init();
            const closeSpy = sinon_1.default.spy(transport.endpoint, 'close');
            yield transport.close();
            expect(closeSpy.callCount).to.equal(1);
        }));
        it('should call stopEventLoop', () => __awaiter(this, void 0, void 0, function* () {
            yield transport.init();
            const stopEventLoopSpy = sinon_1.default.spy(transport, 'stopEventLoop');
            yield transport.close();
            expect(stopEventLoopSpy.callCount).to.equal(1);
        }));
    });
    describe('#stopEventLoop', () => {
        it('should call remove all listeners on super class', () => __awaiter(this, void 0, void 0, function* () {
            const removeListenersSpy = sinon_1.default.spy(transport, 'removeAllListeners');
            yield transport.close();
            expect(removeListenersSpy.callCount).to.equal(1);
        }));
        it('should stop poll on read endpoint', () => __awaiter(this, void 0, void 0, function* () {
            transport.running = true;
            yield transport.init();
            yield transport.close();
            expect(transport.running).to.equals(false);
        }));
    });
    describe('#receive', () => {
        it('should throw error with "Deprecated" error message', () => __awaiter(this, void 0, void 0, function* () {
            try {
                yield transport.receive();
                expect(true).to.equals(false);
            }
            catch (e) {
                expect(e.message).to.equals('Deprecated Method!');
            }
        }));
    });
    describe('#transfer', () => {
        let writeStub;
        beforeEach(() => __awaiter(this, void 0, void 0, function* () {
            yield transport.init();
            writeStub = sinon_1.default.stub(transport.endpoint, 'write')
                .returns(new Promise(resolve => {
                setTimeout(resolve, 10);
            }));
        }));
        afterEach(() => {
            writeStub.restore();
        });
        it('should transfer buffer over out endpoint', () => __awaiter(this, void 0, void 0, function* () {
            const messageBuffer = Buffer.from('test');
            yield transport.transfer(messageBuffer);
            console.log(writeStub.callCount);
            expect(writeStub).to.have.been.calledWith(messageBuffer);
        }));
        it('should fail transfer buffer when out endpoint transfer returns error', () => __awaiter(this, void 0, void 0, function* () {
            const messageBuffer = Buffer.from('test');
            const failedError = new Error('Failed');
            writeStub.rejects(failedError);
            try {
                yield transport.transfer(messageBuffer);
                expect(true).to.be.equal(false);
            }
            catch (e) {
                expect(e).to.equal(failedError);
            }
        }));
        it('should transfer buffer in chunks when buffer is larger than MAX_PACKET_SIZE', () => __awaiter(this, void 0, void 0, function* () {
            const command = 'ECHO';
            const payloadLen = (MAX_PACKET_SIZE - command.length - 16) * 2;
            const payload = crypto_1.default.randomBytes(payloadLen);
            const msg = messagepacket_1.default.createMessage(command, payload);
            const sendChunkSpy = sinon_1.default.spy(transport, 'sendChunk');
            yield transport.transfer(msg);
            expect(sendChunkSpy.callCount).to.be.equal(2);
            expect(sendChunkSpy.firstCall.args[0].length).to.equal(MAX_PACKET_SIZE);
        }));
    });
    describe('#readChunk', () => {
        let readStub;
        beforeEach(() => __awaiter(this, void 0, void 0, function* () {
            yield transport.init();
            readStub = sinon_1.default.stub(transport.endpoint, 'read');
        }));
        afterEach(() => {
            readStub.restore();
        });
        it('should call transfer on out endpoint', () => __awaiter(this, void 0, void 0, function* () {
            readStub.resolves(messagepacket_1.default.createMessage('test', 'test'));
            yield transport.readChunk(MAX_PACKET_SIZE);
            expect(readStub).to.been.called;
            expect(readStub.firstCall.args[0]).to.be.equal(MAX_PACKET_SIZE);
        }));
    });
    describe('#sendChunk', () => {
        let writeStub;
        beforeEach(() => __awaiter(this, void 0, void 0, function* () {
            yield transport.init();
            writeStub = sinon_1.default.stub(transport.endpoint, 'write')
                .returns(new Promise(resolve => {
                setTimeout(resolve, 10);
            }));
        }));
        afterEach(() => {
            writeStub.restore();
        });
        it('should call transfer on in endpoint', () => __awaiter(this, void 0, void 0, function* () {
            yield transport.init();
            writeStub.resolves();
            const bufferToSend = Buffer.from('send-me');
            yield transport.sendChunk(bufferToSend);
            expect(writeStub).to.been.called;
            expect(writeStub.firstCall.args[0]).to.be.equal(bufferToSend);
        }));
    });
    describe('#hlink-handshake', () => {
        let writeStub;
        let readStub;
        beforeEach(() => __awaiter(this, void 0, void 0, function* () {
            yield transport.init();
            writeStub = sinon_1.default.stub(transport.endpoint, 'write')
                .returns(new Promise(resolve => {
                setTimeout(resolve, 10);
            }));
            readStub = sinon_1.default.stub(transport.endpoint, 'read');
        }));
        afterEach(() => {
            writeStub.restore();
            readStub.restore();
        });
        it('should correctly perform hlink salutation process', () => __awaiter(this, void 0, void 0, function* () {
            readStub.resolves(Buffer.from('HLink v0'));
            yield transport.performHlinkHandshake();
            // Reset Sequence transfer
            expect(writeStub.callCount).to.be.equal(3);
            expect(writeStub.firstCall.args[0].compare(Buffer.from([]))).to.be.equal(0);
            expect(writeStub.secondCall.args[0].compare(Buffer.from([]))).to.be.equal(0);
            expect(writeStub.thirdCall.args[0].compare(Buffer.from([0]))).to.be.equal(0);
            // Read message
            expect(readStub.callCount).to.be.equal(1);
            expect(readStub.firstCall.args[0]).to.be.equal(1024);
        }));
        it('should fail when salutation message is not "Hlink v0"', () => __awaiter(this, void 0, void 0, function* () {
            readStub.resolves(Buffer.from('Hlink v0000'));
            try {
                yield transport.performHlinkHandshake();
                expect(true).to.equals(false);
            }
            catch (error) {
                expect(error).to.contain('Hlink handshake has failed!');
            }
        }));
    });
});
//# sourceMappingURL=transport.spec.js.map