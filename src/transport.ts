import ITransport from '@huddly/sdk/lib/src/interfaces/iTransport';
import usb from 'usb';
import MessagePacket from './messagepacket';
import { EventEmitter } from 'events';

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
  inEndpoint: usb.InEndpoint;
  outEndpoint: usb.OutEndpoint;

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
    await this.sleep();
    return new Promise((resolve, reject) => {
      try {
        this.device.open();
        let vscInterfaceClaimed = false;
        this.device.interfaces.forEach(deviceInterface => {
          if (deviceInterface.descriptor.bInterfaceClass === this.VSC_INTERFACE_CLASS) {
            this.vscInterface = deviceInterface;
            this.vscInterface.claim();
            vscInterfaceClaimed = true;
            deviceInterface.endpoints.forEach(endpoint => {
              if (endpoint instanceof usb.InEndpoint) {
                this.inEndpoint = endpoint;
              }
              if (endpoint instanceof usb.OutEndpoint) {
                this.outEndpoint = endpoint;
              }
            });
          }
        });
        if (!vscInterfaceClaimed) {
          reject('No VSC Interface present on the usb device!');
        } else {
          resolve();
        }
      } catch (err) {
        this.closeDevice();
        if (err.errno === usb.LIBUSB_ERROR_ACCESS) {
          this.logger.warn('Unable to claim usb interface. Please make sure the device is not used by another process!');
          reject(`Unable to claim usb interface. Please make sure the device is not used by another process!`);
        } else {
          this.logger.warn('Error Occurred claiming interface!');
          reject(`Error Occurred claiming interface! ${err}`);
        }
      }
    });
  }

  initEventLoop(): void {
    this.inEndpoint.startPoll(1, this.MAX_PACKET_SIZE);
    this.startListen();
    this.running = true;
  }

  async startListen(): Promise<void> {
    const chunks = [];
    let currentSize = 0;
    let expectedSize;
    let currentState = this.READ_STATES.NEW_READ;

    const finalizeRead = () => {
      currentState = this.READ_STATES.NEW_READ;
      const finalBuff = Buffer.concat(chunks, currentSize);
      const result = MessagePacket.parseMessage(finalBuff);
      chunks.splice(0, chunks.length);
      currentSize = 0;
      this.emit(result.message, result);
    };

    this.inEndpoint.on('data', (buff) => {
      if (currentState === this.READ_STATES.NEW_READ) {
        if (buff.length < MessagePacket.HEADER_SIZES.HDR_SIZE) {
          this.logger.warn('Unable to proceed with reading! Target returned a reset sequence during read!');
          this.close();
          throw new Error('Received a reset sequence message from target during read!');
        }
        chunks.push(buff);
        currentSize += buff.length;
        const parsedChunk = MessagePacket.parseMessage(buff);
        expectedSize = MessagePacket.HEADER_SIZES.HDR_SIZE + parsedChunk.messageSize + parsedChunk.payloadSize;
        if (currentSize < expectedSize) {
          currentState = this.READ_STATES.PENDING_CHUNK;
        } else {
          finalizeRead();
        }
      } else {
        chunks.push(buff);
        currentSize += buff.length;
        if (currentSize < expectedSize) {
          currentState = this.READ_STATES.PENDING_CHUNK;
        } else {
          finalizeRead();
        }
      }
    });

    this.inEndpoint.on('error', (err) => {
      this.logger.warn(`Received an error message on read loop! ${err}`);
      this.close();
    });

    this.inEndpoint.on('end', () => {
      // Polling has stopped!
    });
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
          reject(`Request has timed out!`);
        } finally {
          clearTimeout(timer);
        }
      }, timeout);
      this.once(msg, res => resolve(res));
    });
  }

  read(receiveMsg: string = 'unknown', timeout: number = 500): Promise<any> {
    throw new Error('Depricated Method!');
  }

  write(cmd: string, payload: any = Buffer.alloc(0)): Promise<any> {
    const encodedMsgBuffer = MessagePacket.createMessage(cmd, payload);
    return this.transfer(encodedMsgBuffer);
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
    await this.cancelTransfers();
    await this.closeDevice();
  }

  async stopEventLoop(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.removeAllListeners();
      if (this.running) {
        this.running = false;
        this.inEndpoint.stopPoll(async () => {
          resolve();
        });
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

  async cancelTransfers(): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.device && this.vscInterface) {
        this.vscInterface.release([this.inEndpoint, this.outEndpoint], (err) => {
          if (err) reject(`Releasing the interface failed! ${err}`);
          else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  async closeDevice(): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.device) {
        try {
          this.device.close();
          resolve();
        } catch (e) {
          reject(`Cannot close usb device! Error: ${e}`);
        }
      } else {
        resolve();
      }
    });
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
    return new Promise((resolve, reject) => {
      this.inEndpoint.transfer(packetSize, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }

  async sendChunk(chunk: Buffer): Promise<any> {
    return new Promise((resolve, reject) => {
      this.outEndpoint.transfer(chunk, (outTError) => {
        if (outTError) {
          if (outTError.errno === usb.LIBUSB_ERROR_PIPE && this.outEndpoint) {
            this.outEndpoint.clearHalt((haltError) =>
              reject(`Clear halt failed on out endpoint!${haltError ? ` Error: ${haltError}` : ''}`)
            );
          } else {
            reject(`Transfer failed! ${outTError}`);
          }
        } else {
          resolve();
        }
      });
    });
  }

  async performHlinkHandshake(): Promise<any> {
    await this.sendChunk(Buffer.alloc(0));
    await this.sendChunk(Buffer.alloc(1, 0x00));
    const res = await this.readChunk(1024);
    const decodedMsg = res.toString('utf8');
    if (decodedMsg !== 'HLink v0') {
      this.logger.warn('Hlink handshake has failed! Wrong version!');
      return Promise.reject('HLink handshake mechanism failed! Wrong version!');
    }
    return Promise.resolve();
  }
}
