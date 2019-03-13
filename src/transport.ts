import ITransport from '@huddly/sdk/lib/src/interfaces/iTransport';
import DeviceEndpoint from './bulkusbendpoint';
import MessagePacket from './messagepacket';
import { EventEmitter } from 'events';
import { timingSafeEqual } from 'crypto';

const MAX_USB_PACKET = 16 * 1024;

const HEADER_TIMEOUT_MS = 10;

function CeilDiv(a, b) { return Math.ceil(a / b); }

function AlignUp(length, alignment) {
  return alignment * CeilDiv(length, alignment);
}

interface SendMessage {
  resolve(message?: any): void;
  reject(message: any): void;
  msgBuffer: Buffer;
}

export default class NodeUsbTransport extends EventEmitter implements ITransport {
  readonly MAX_PACKET_SIZE: number = (16 * 1024);
  readonly VSC_INTERFACE_CLASS = 255; // Vendor Specifc Class
  readonly DEFAULT_LOOP_READ_SPEED = 60000;
  readonly READ_STATES = Object.freeze({
    NEW_READ: 'new_read',
    PENDING_CHUNK: 'pending_chunk'
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
  timeoutMs: Number = 100;
  listenerTimeoutId: Number;
  sendQueue: Array<SendMessage> = [];

  constructor(device: any, logger: any) {
    super();
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
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        resolve();
      }, (seconds * 1000));
    });
  }

  async init(): Promise<any> {
    if (!this.device.endpoint) {
      try {
        const endpoint = await this.device.open();
        this.endpoint = endpoint;
        this.device.endpoint = endpoint;
      } catch (e) {
        throw e;
      }
    } else {
      this.endpoint = this.device.endpoint;
    }
  }

  initEventLoop(): void {
    this.startbulkReadWrite();
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
        throw e;
      }
    }
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
    if (!this.endpoint) {
      throw new Error('Reading from closed endpoint');
    }
    do {
      let uint8Buf: Buffer;
      try {
        uint8Buf = await this.endpoint.read(4096, HEADER_TIMEOUT_MS);
      } catch (e) {
        if (e.message === 'LIBUSB_ERROR_TIMEOUT') {
          return;
        }
        throw e;
      }
      headerBuffer = Buffer.from(uint8Buf);
      if (headerBuffer.length === 0) {
        this.emit('TRANSPORT_RESET');
      }
    } while (headerBuffer.length === 0);

    if (headerBuffer.length < MessagePacket.HEADER_SIZES.HDR_SIZE) {
      throw new Error(`Hlink: header is too small ${headerBuffer.length}`);
    }

    const parsedChunk = MessagePacket.parseMessage(headerBuffer);
    const expectedSize = MessagePacket.HEADER_SIZES.HDR_SIZE + parsedChunk.messageSize + parsedChunk.payloadSize;
    const chunks = [headerBuffer];

    for (let currentLength = headerBuffer.length; currentLength < expectedSize;) {
      try {
        if (!this.endpoint) {
          throw new Error('Reading from closed endpoint');
        }
        const buf = await this.endpoint.read(
          Math.min(AlignUp(expectedSize - currentLength, 1024), MAX_USB_PACKET),
          this.timeoutMs
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
    throw new Error('----------- SHOLUD NOT HAPPEND legacy listen --------------');
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
      this.once(msg, res => {
        clearTimeout(timer);
        resolve(res);
      });
    });
  }

  read(receiveMsg: string = 'unknown', timeout: number = 500): Promise<any> {
    throw new Error('Depricated Method!');
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
    await this.stopEventLoop();
    await this.closeDevice();
  }

  async stopEventLoop(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.removeAllListeners();
      if (this.running) {
        this.running = false;
      } else {
        resolve();
      }
    });
  }

  async claimInterface(): Promise<any> {
    if (this.device) {
      return this.init();
    }

    return Promise.reject('Unable to claim interface of an uninitialized device!');
  }

  async closeDevice(): Promise<any> {
    const endpoint = this.endpoint;
    this.endpoint = undefined;
    try {
      await endpoint.close();
    } catch (e) {
      // Failing on closing on endpoint is ok
    }
    this._device = undefined;
  }

  async receive(): Promise<Buffer> {
    throw new Error('Depricated Method!');
  }

  async transfer(messageBuffer: Buffer) {
    for (let i = 0; i < messageBuffer.length; i += this.MAX_PACKET_SIZE) {
      const chunk = messageBuffer.slice(i, i + this.MAX_PACKET_SIZE);
      await this.sendChunk(chunk);
    }
  }

  async readChunk(packetSize: number = this.MAX_PACKET_SIZE): Promise<any> {
    return this.endpoint.read(packetSize, this.timeoutMs);
  }

  async sendChunk(chunk: Buffer): Promise<any> {
    if (!this.endpoint) {
      throw new Error('Writing from closed endpoint');
    }
    return this.endpoint.write(chunk, 10000);
  }

  async performHlinkHandshake(): Promise<any> {
    const cmds = [];
    cmds.push(this.sendChunk(Buffer.from([])));
    cmds.push(this.sendChunk(Buffer.from([])));
    cmds.push(this.sendChunk(Buffer.from([0])));
    cmds.push(this.readChunk(1024));
    const [, , , res] = await Promise.all(cmds);
    const decodedMsg = Buffer.from(res).toString('utf8');

    if (decodedMsg !== 'HLink v0') {
      this.logger.warn('Hlink handshake has failed! Wrong version!');
      return Promise.reject('HLink handshake mechanism failed! Wrong version!');
    }
    return Promise.resolve();
  }
}
