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
const await_sleep_1 = __importDefault(require("await-sleep"));
const messagepacket_1 = __importDefault(require("./messagepacket"));
const events_1 = require("events");
const MAX_USB_PACKET = 16 * 1024;
const HEADER_TIMEOUT_MS = 10;
function CeilDiv(a, b) { return Math.ceil(a / b); }
function AlignUp(length, alignment) {
    return alignment * CeilDiv(length, alignment);
}
class NodeUsbTransport extends events_1.EventEmitter {
    constructor(device, logger) {
        super();
        this.MAX_PACKET_SIZE = (16 * 1024);
        this.VSC_INTERFACE_CLASS = 255; // Vendor Specifc Class
        this.DEFAULT_LOOP_READ_SPEED = 60000;
        this.READ_STATES = Object.freeze({
            NEW_READ: 'new_read',
            PENDING_CHUNK: 'pending_chunk'
        });
        /**
         * The evetLoopSpeed shall not be used in this class since node-usb read
         * endpoint does not send back empty buffers unless there is something
         * to send back. In that case the read will be resolved and the loop will
         * proceed imediately to read the next packet (and potentially wait until
         * the next packet arrives). This function is used to maintain compatibility
         * with the other device-api transport implementations.
         *
         * @type {number}
         * @memberof NodeUsbTransport
         */
        this.eventLoopSpeed = this.DEFAULT_LOOP_READ_SPEED;
        this.timeoutMs = 100;
        this.sendQueue = [];
        this._device = device;
        this.logger = logger;
        super.setMaxListeners(50);
    }
    /**
     * Getter method for device class attribute.
     *
     * @type {*}
     * @memberof NodeUsbTransport
     */
    get device() {
        return this._device;
    }
    /**
     * Set method for device class attribute.
     *
     * @memberof NodeUsbTransport
     */
    set device(device) {
        this._device = device;
    }
    setEventLoopReadSpeed(timeout = this.DEFAULT_LOOP_READ_SPEED) {
        // Uncomment the line below when the eventLoopSpeed variable is used in this class.
        // this.eventLoopSpeed = timeout;
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.device.endpoint) {
                // Wait for UVC device to settle before claiming
                yield await_sleep_1.default(100);
                try {
                    const endpoint = yield this.device.open();
                    this.endpoint = endpoint;
                    this.device.endpoint = endpoint;
                }
                catch (e) {
                    throw e;
                }
            }
            else {
                this.endpoint = this.device.endpoint;
            }
        });
    }
    initEventLoop() {
        this.startbulkReadWrite().catch(e => {
            this.logger.error(`Failed read write loop stopped unexpectingly ${e}`);
            this.emit('ERROR', e);
        });
    }
    startbulkReadWrite() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.running) {
                return Promise.resolve();
            }
            let isAttached = true;
            this.device.onDetach(() => {
                isAttached = false;
            });
            this.running = true;
            this.device.isAttached = true;
            while (isAttached && this.running) {
                try {
                    yield this.sendMessage();
                    yield this.readMessage();
                }
                catch (e) {
                    if (e.message === 'LIBUSB_NO_DEVICE') {
                        isAttached = false;
                    }
                    this.logger.warn(`Failed in bulk read write loop with ${e}. Resuming.`);
                }
                // Allow other fn on callstack to be called
                yield new Promise(res => setImmediate(res));
            }
            this.logger.warn(`Read write loop terminated. isAttached=${isAttached}. running=${this.running}`);
            this.running = false;
        });
    }
    sendMessage() {
        return __awaiter(this, void 0, void 0, function* () {
            while (this.sendQueue.length !== 0) {
                const sendMessage = this.sendQueue.shift();
                const { reject, resolve, msgBuffer } = sendMessage;
                try {
                    yield this.transfer(msgBuffer);
                    resolve();
                }
                catch (e) {
                    if (e.message === 'LIBUSB_ERROR_TIMEOUT') {
                        throw e;
                    }
                    reject(e);
                }
            }
        });
    }
    readMessage() {
        return __awaiter(this, void 0, void 0, function* () {
            let headerBuffer;
            do {
                try {
                    headerBuffer = yield this.endpoint.read(4096, HEADER_TIMEOUT_MS);
                }
                catch (e) {
                    if (e.message === 'LIBUSB_ERROR_TIMEOUT') {
                        return;
                    }
                    throw e;
                }
                if (headerBuffer.length === 0) {
                    this.emit('TRANSPORT_RESET');
                    this.logger.warn('Hlink transport reset message recieved during read');
                    return;
                }
            } while (headerBuffer.length === 0);
            if (headerBuffer.length < messagepacket_1.default.HEADER_SIZES.HDR_SIZE) {
                throw new Error(`Hlink: header is too small ${headerBuffer.length}`);
            }
            const expectedSize = messagepacket_1.default.parseMessage(headerBuffer).totalSize();
            const chunks = [headerBuffer];
            for (let currentLength = headerBuffer.length; currentLength < expectedSize;) {
                try {
                    const buf = yield this.endpoint.read(Math.min(AlignUp(expectedSize - currentLength, 1024), MAX_USB_PACKET), this.timeoutMs);
                    chunks.push(Buffer.from(buf));
                    currentLength += buf.length;
                }
                catch (e) {
                    if (e.message === 'LIBUSB_ERROR_TIMEOUT') {
                        continue;
                    }
                    throw new Error(`read loop failed ${e}`);
                }
            }
            const finalBuff = Buffer.concat(chunks);
            const result = messagepacket_1.default.parseMessage(finalBuff);
            chunks.splice(0, chunks.length);
            this.emit(result.message, result);
        });
    }
    startListen() {
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error('----------- SHOLUD NOT HAPPEND legacy listen --------------');
        });
    }
    on(eventName, listener) {
        super.on(eventName, listener);
        return this;
    }
    removeListener(eventName, listener) {
        super.removeListener(eventName, listener);
        return this;
    }
    removeAllListeners(eventName) {
        super.removeAllListeners(eventName);
        return this;
    }
    receiveMessage(msg, timeout = 500) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            const timer = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                try {
                    this.removeAllListeners(msg);
                    reject(`Request has timed out! ${msg} ${timeout}`);
                }
                finally {
                    clearTimeout(timer);
                }
            }), timeout);
            this.once(msg, res => {
                clearTimeout(timer);
                resolve(res);
            });
            this.once('ERROR', error => {
                clearTimeout(timer);
                reject(error);
            });
        }));
    }
    read(receiveMsg = 'unknown', timeout = 500) {
        throw new Error('Deprecated Method!');
    }
    write(cmd, payload = Buffer.alloc(0)) {
        const encodedMsgBuffer = messagepacket_1.default.createMessage(cmd, payload);
        return new Promise((resolve, reject) => {
            this.sendQueue.push({ resolve, reject, msgBuffer: encodedMsgBuffer });
        });
    }
    subscribe(command) {
        return this.write('hlink-mb-subscribe', command);
    }
    unsubscribe(command) {
        return this.write('hlink-mb-unsubscribe', command);
    }
    clear() {
        return Promise.resolve();
        // return this.performHlinkHandshake(); // Uncomenting this line will make the usb communication stuck
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.stopEventLoop();
            yield this.closeDevice();
        });
    }
    stopEventLoop() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => {
                this.removeAllListeners();
                this.running = false;
                resolve();
            });
        });
    }
    claimInterface() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.device) {
                return this.init();
            }
            return Promise.reject('Unable to claim interface of an uninitialized device!');
        });
    }
    closeDevice() {
        return __awaiter(this, void 0, void 0, function* () {
            const endpoint = this.endpoint;
            this.endpoint = undefined;
            try {
                yield endpoint.close();
            }
            catch (e) {
                // Failing on closing on endpoint is ok
            }
            this._device = undefined;
        });
    }
    receive() {
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error('Deprecated Method!');
        });
    }
    transfer(messageBuffer) {
        return __awaiter(this, void 0, void 0, function* () {
            for (let i = 0; i < messageBuffer.length; i += this.MAX_PACKET_SIZE) {
                const chunk = messageBuffer.slice(i, i + this.MAX_PACKET_SIZE);
                yield this.sendChunk(chunk);
            }
        });
    }
    readChunk(packetSize = this.MAX_PACKET_SIZE) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.endpoint.read(packetSize, this.timeoutMs);
        });
    }
    sendChunk(chunk) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.endpoint) {
                throw new Error('Writing from closed endpoint');
            }
            return this.endpoint.write(chunk, 10000);
        });
    }
    performHlinkHandshake() {
        return __awaiter(this, void 0, void 0, function* () {
            const cmds = [];
            cmds.push(this.sendChunk(Buffer.from([])));
            cmds.push(this.sendChunk(Buffer.from([])));
            cmds.push(this.sendChunk(Buffer.from([0])));
            cmds.push(this.readChunk(1024));
            const [, , , res] = yield Promise.all(cmds);
            const decodedMsg = Buffer.from(res).toString('utf8');
            const expected = 'HLink v0';
            if (decodedMsg !== expected) {
                const message = `Hlink handshake has failed! Wrong version. Expected ${expected}, got ${decodedMsg}.`;
                this.logger.warn(message);
                return Promise.reject(message);
            }
            return Promise.resolve();
        });
    }
}
exports.default = NodeUsbTransport;
//# sourceMappingURL=transport.js.map