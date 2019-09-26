import ITransport from '@huddly/sdk/lib/src/interfaces/iTransport';
import DeviceEndpoint from './bulkusbendpoint';
import MessagePacket from './messagepacket';
import { EventEmitter } from 'events';
import throttle from 'lodash.throttle';

const MAX_USB_PACKET = 16 * 1024;

const READ_TRANSFER_TIMEOUT_MS = 100;
const HEADER_TIMEOUT_MS = 100;
const MAX_LOG_ERROR_WRITE_MS = 100;

function CeilDiv(a, b) {
  return Math.ceil(a / b);
}

function AlignUp(length, alignment) {
  return alignment * CeilDiv(length, alignment);
}

interface SendMessage {
  resolve(message?: any): void;
  reject(message: any): void;
  msgBuffer: Buffer;
}

export default class NodeUsbTransport extends EventEmitter implements ITransport {
  readonly MAX_PACKET_SIZE: number = 16 * 1024;
  readonly VSC_INTERFACE_CLASS = 255; // Vendor Specifc Class
  readonly DEFAULT_LOOP_READ_SPEED = 60000;
  readonly READ_STATES = Object.freeze({
    NEW_READ: 'new_read',
    PENDING_CHUNK: 'pending_chunk',
  });

  _device: any;

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
  eventLoopSpeed: number = this.DEFAULT_LOOP_READ_SPEED;

  logger: any;
  running: any;
  vscInterface: any;
  endpoint: DeviceEndpoint;
  readTimeoutMs: Number;
  headerReadTimeoutMs: Number;
  listenerTimeoutId: Number;
  sendQueue: Array<SendMessage> = [];

  constructor(device: any, logger: any) {
    super();
    this._device = device;
    this.logger = logger;
    this.readTimeoutMs = process.env.HLINK_READ_TIMEOUT_MS
      ? +process.env.HLINK_READ_TIMEOUT_MS
      : READ_TRANSFER_TIMEOUT_MS;
    this.headerReadTimeoutMs = process.env.HLINK_HEADER_TIMEOUT_MS
      ? +process.env.HLINK_HEADER_TIMEOUT_MS
      : HEADER_TIMEOUT_MS;
    super.setMaxListeners(50);
  }

  /**
   * Getter method for device class attribute.
   *
   * @type {*}
   * @memberof NodeUsbTransport
   */
  get device(): any {
    return this._device;
  }

  /**
   * Set method for device class attribute.
   *
   * @memberof NodeUsbTransport
   */
  set device(device: any) {
    this._device = device;
  }

  setEventLoopReadSpeed(timeout: number = this.DEFAULT_LOOP_READ_SPEED): void {
    // Uncomment the line below when the eventLoopSpeed variable is used in this class.
    // this.eventLoopSpeed = timeout;
  }

  async sleep(seconds: number = 1): Promise<any> {
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        resolve();
      }, seconds * 1000);
    });
  }

  async init(): Promise<any> {
    if (!this.device) {
      this.logger.error(
        'Device instance is undefined. Cannot init transport',
        '',
        'Device API USB Transport'
      );
      throw new Error('Can not init transport without device');
    }

    if (!this.device.endpoint) {
      try {
        const endpoint = await this.device.open();
        this.endpoint = endpoint;
        this.device.endpoint = endpoint;
      } catch (e) {
        this.logger.error('Unable to open device / claim endpoint', e, 'Device API USB Transport');
        throw e;
      }
    } else {
      this.endpoint = this.device.endpoint;
    }
  }

  initEventLoop(): void {
    const logErrorThrottled = throttle(e => {
      this.logger.error(
        'Error! read/write loop stopped unexpectingly',
        e,
        'Device API USB Transport'
      );
    }, MAX_LOG_ERROR_WRITE_MS);
    this.startbulkReadWrite().catch(e => {
      logErrorThrottled(e);
      this.emit('ERROR', e);
    });
  }

  async startbulkReadWrite(): Promise<void> {
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
        await this.sendMessage();
        await this.readMessage();
      } catch (e) {
        if (e.message === 'LIBUSB_NO_DEVICE') {
          isAttached = false;
        }
        this.logger.error(`Failed in bulk read write! Resuming.`, e, 'Device API USB Transport');
      }
      // Allow other fn on callstack to be called
      await new Promise(res => setImmediate(res));
    }
    this.logger.warn(
      `Read write loop terminated. isAttached=${isAttached}. running=${this.running}`,
      'Device API USB Transport'
    );
    this.running = false;
  }

  async sendMessage(): Promise<void> {
    while (this.sendQueue.length !== 0) {
      const sendMessage = this.sendQueue.shift();
      const { reject, resolve, msgBuffer } = sendMessage;
      try {
        await this.transfer(msgBuffer);
        resolve();
      } catch (e) {
        if (e.message === 'LIBUSB_ERROR_TIMEOUT') {
          throw e;
        }
        reject(e);
      }
    }
  }

  async readMessage(): Promise<void> {
    let headerBuffer: Buffer;
    do {
      try {
        headerBuffer = await this.endpoint.read(4096, this.headerReadTimeoutMs);
      } catch (e) {
        if (e.message === 'LIBUSB_ERROR_TIMEOUT') {
          return;
        }
        throw e;
      }
    } while (headerBuffer.length === 0);

    if (headerBuffer.length < MessagePacket.HEADER_SIZES.HDR_SIZE) {
      this.logger.error(
        `Hlink: header is too small ${headerBuffer.length}`,
        '',
        'Device API USB Transport'
      );
      throw new Error(`Hlink: header is too small ${headerBuffer.length}`);
    }

    const expectedSize = MessagePacket.parseMessage(headerBuffer).totalSize();
    const chunks = [headerBuffer];

    for (let currentLength = headerBuffer.length; currentLength < expectedSize; ) {
      try {
        const buf = await this.endpoint.read(
          Math.min(AlignUp(expectedSize - currentLength, 1024), MAX_USB_PACKET),
          this.readTimeoutMs
        );
        chunks.push(Buffer.from(buf));
        currentLength += buf.length;
      } catch (e) {
        if (e.message === 'LIBUSB_ERROR_TIMEOUT') {
          continue;
        }
        throw new Error(`read loop failed ${e}`);
      }
    }
    const finalBuff = Buffer.concat(chunks);
    const result = MessagePacket.parseMessage(finalBuff);
    chunks.splice(0, chunks.length);
    this.emit(result.message, result);
  }

  async startListen(): Promise<void> {
    this.logger.error(
      'Attempting to call [startListen]! Method not supported',
      '',
      'Device API USB Transport'
    );
    throw new Error('Method not supported');
  }

  on(eventName: string, listener: any): this {
    super.on(eventName, listener);
    return this;
  }

  removeListener(eventName: string, listener: any): this {
    super.removeListener(eventName, listener);
    return this;
  }

  removeAllListeners(eventName?: string): this {
    super.removeAllListeners(eventName);
    return this;
  }

  receiveMessage(msg: string, timeout: number = 500): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const timer = setTimeout(async () => {
        try {
          this.removeAllListeners(msg);
          reject(`Request has timed out! ${msg} ${timeout}`);
        } finally {
          clearTimeout(timer);
        }
      }, timeout);

      const messageHandler = res => {
        clearTimeout(timer);
        this.removeListener('ERROR', errorHandler);
        resolve(res);
      };
      const errorHandler = error => {
        clearTimeout(timer);
        this.removeListener(msg, messageHandler);
        reject(error);
      };

      this.once(msg, messageHandler);
      this.once('ERROR', errorHandler);
    });
  }

  read(receiveMsg: string = 'unknown', timeout: number = 500): Promise<any> {
    this.logger.error(
      'Attempting to call [read]! Method not supported',
      '',
      'Device API USB Transport'
    );
    throw new Error('Method not supported');
  }

  write(cmd: string, payload: any = Buffer.alloc(0)): Promise<any> {
    const encodedMsgBuffer = MessagePacket.createMessage(cmd, payload);
    return new Promise((resolve, reject) => {
      this.sendQueue.push({ resolve, reject, msgBuffer: encodedMsgBuffer });
    });
  }

  subscribe(command: string): Promise<any> {
    return this.write('hlink-mb-subscribe', command);
  }

  unsubscribe(command: string): Promise<any> {
    return this.write('hlink-mb-unsubscribe', command);
  }

  clear(): Promise<any> {
    return Promise.resolve();
    // return this.performHlinkHandshake(); // Uncomenting this line will make the usb communication stuck
  }

  async close(): Promise<void> {
    this.logger.debug('Closing event loop and device handle', 'Device API USB Transport');
    await this.stopEventLoop();
    await this.closeDevice();
  }

  async stopEventLoop(): Promise<any> {
    return new Promise(resolve => {
      this.removeAllListeners();
      this.running = false;
      resolve();
    });
  }

  async claimInterface(): Promise<any> {
    if (this.device) {
      return this.init();
    }
    this.logger.warn(
      'Unable to claim interface on an uninitialized device',
      'Device API USB Transport'
    );
    return Promise.reject('Unable to claim interface of an uninitialized device!');
  }

  async closeDevice(): Promise<any> {
    const endpoint = this.endpoint;
    this.endpoint = undefined;
    try {
      await endpoint.close();
    } catch (e) {
      this.logger.warn('Failure while closing the device endpoint', 'Device API USB Transport');
      // Failing on closing on endpoint is ok
    }
    this._device = undefined;
  }

  async receive(): Promise<Buffer> {
    this.logger.warn('Failure while closing the device endpoint', 'Device API USB Transport');
    throw new Error('Method not supported');
  }

  async transfer(messageBuffer: Buffer) {
    for (let i = 0; i < messageBuffer.length; i += this.MAX_PACKET_SIZE) {
      const chunk = messageBuffer.slice(i, i + this.MAX_PACKET_SIZE);
      await this.sendChunk(chunk);
    }
  }

  async readChunk(packetSize: number = this.MAX_PACKET_SIZE): Promise<any> {
    return this.endpoint.read(packetSize, this.readTimeoutMs);
  }

  async sendChunk(chunk: Buffer): Promise<any> {
    if (!this.endpoint) {
      throw new Error('Writing from closed endpoint');
    }
    return this.endpoint.write(chunk, 10000);
  }

  async performHlinkHandshake(): Promise<void> {
    const cmds = [];
    cmds.push(this.sendChunk(Buffer.from([])));
    cmds.push(this.sendChunk(Buffer.from([])));
    cmds.push(this.sendChunk(Buffer.from([0])));
    cmds.push(this.readChunk(1024));
    const [, , , res] = await Promise.all(cmds);
    const decodedMsg = Buffer.from(res).toString('utf8');

    const expected = 'HLink v0';
    if (decodedMsg !== expected) {
      const message = `Hlink handshake has failed! Wrong version. Expected ${expected}, got ${decodedMsg}.`;
      this.logger.warn(message);
      return Promise.reject(message);
    }
    return Promise.resolve();
  }
}
