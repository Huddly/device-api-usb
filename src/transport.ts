import { EventEmitter } from 'events';
import { usb } from 'usb';
import { Endpoint, InEndpoint, OutEndpoint } from 'usb/dist/usb/endpoint';
import { Interface } from 'usb/dist/usb/interface';

import ITransport from '@huddly/sdk-interfaces/lib/interfaces/ITransport';
import Logger from '@huddly/sdk-interfaces/lib/statics/Logger';

import MessagePacket, { Message } from './messagepacket';

export default class NodeUsbTransport extends EventEmitter implements ITransport {
  private readonly MAX_PACKET_SIZE: number = 16 * 1024;
  private readonly VSC_INTERFACE_CLASS = 255; // Vendor Specifc Class
  private _device: usb.Device;
  private readonly READ_STATES = Object.freeze({
    NEW_READ: 'new_read',
    PENDING_CHUNK: 'pending_chunk'
  });
  private readonly className: string = 'Device-API-USB Transport';


  vscInterface: Interface;
  inEndpoint: InEndpoint;
  outEndpoint: OutEndpoint;
  ifOpenedAndEndpointsClaimed: boolean = false;
  isPollingActive: boolean = false;

  constructor(device: usb.Device) {
    super();
    this._device = device;
    super.setMaxListeners(50);
  }

  /**
   * Getter method for device class attribute.
   *
   * @type {*}
   * @memberof NodeUsbTransport
   */
  get device(): usb.Device {
    return this._device;
  }

  /**
   * Set method for device class attribute.
   *
   * @memberof NodeUsbTransport
   */
  set device(device: usb.Device) {
    this._device = device;
  }

  init(): Promise<void> {
    if (this.ifOpenedAndEndpointsClaimed) {
      return;
    }

    let opened: boolean = false;
    return new Promise(async (resolve, reject) => {
      try {
        this.device.open();
        opened = true;
        const vscInterface: Interface = this.device.interfaces.find((ifc: Interface) => (ifc.descriptor.bInterfaceClass === this.VSC_INTERFACE_CLASS));
        if (!vscInterface) return reject('No VSC Interface present on the usb device!');

        this.vscInterface = vscInterface;
        this.vscInterface.claim();
        this.inEndpoint = this.vscInterface.endpoints.find((endpoint: Endpoint) => (endpoint instanceof InEndpoint)) as InEndpoint;
        this.outEndpoint = this.vscInterface.endpoints.find((endpoint: Endpoint) => (endpoint instanceof OutEndpoint)) as OutEndpoint;

        this.ifOpenedAndEndpointsClaimed = true;
        resolve();
      } catch (err) {
        if (opened) {
          await this.close();
        }

        if (err.errno === usb.LIBUSB_ERROR_ACCESS) {
          Logger.warn('Unable to claim usb interface. Please make sure the device is not used by another process!', this.className);
          return reject(`Unable to claim usb interface. Please make sure the device is not used by another process!`);
        }

        Logger.warn('Error Occurred claiming interface!', this.className);
        return reject(`Error Occurred claiming interface! ${err}`);
      }
    });
  }

  initEventLoop(): void {
    if (!this.isPollingActive) {
      Logger.debug('Starting event loop!', this.className);
      this.inEndpoint.startPoll(1, this.MAX_PACKET_SIZE);
      this.startListen();
      this.isPollingActive = true;
    }
  }

  async handleResetSeqRead(headerLen: number): Promise<void> {
    try {
      Logger.warn('Reset sequence message sent from camera! Releasing endpoints, stopping event loop and closing device.', this.className);
      await this.stopEventLoop();
      await this.close();
      this.emit('TRANSPORT_RESET');
    } finally {
      throw new Error(`Hlink: header is too small ${headerLen}`);
    }
  }

  startListen(): void {
    let chunks: Buffer[] = [];
    let currentSize: number = 0;
    let expectedSize: number = -1;
    let currentState: string = this.READ_STATES.NEW_READ;

    const parseAndEmitCompleteMessage: Function = (): void => {
      currentState = this.READ_STATES.NEW_READ;
      const finalBuffer: Buffer = Buffer.concat(chunks);
      const result: Message = MessagePacket.parseMessage(finalBuffer);
      chunks.splice(0, chunks.length); // Empty the array
      currentSize = 0;
      this.emit(result.message, result);
    };

    const continueReadLogic: Function = (): void => {
      if (currentSize < expectedSize) {
        currentState = this.READ_STATES.PENDING_CHUNK;
      } else {
        parseAndEmitCompleteMessage();
      }
    };

    const dataHandler: any = (buffer: Buffer): void => {
      if (currentState === this.READ_STATES.NEW_READ) {
        if (buffer.length < MessagePacket.HEADER_SIZES.HDR_SIZE) {
          this.handleResetSeqRead(buffer.length);
          return;
        }

        expectedSize = MessagePacket.parseMessage(buffer).totalSize();
        chunks = [buffer];
        currentSize = buffer.length;
        continueReadLogic();
      } else {
        chunks.push(Buffer.from(buffer));
        currentSize += buffer.length;
        continueReadLogic();
      }
    };

    const closeHandler: Function = () => {
      Logger.debug('Removing transport data event subscription.', this.className);
      this.inEndpoint?.removeListener('data', dataHandler);
    };

    const errorHandler: any = (error: Error) => {
      Logger.error(`Received error message on read loop!`, error, this.className);
      this.close();
    };


    // Setup event handlers
    this.inEndpoint.on('data', dataHandler);
    this.inEndpoint.once('error', errorHandler);
    this.once('ERROR', errorHandler);
    this.once('CLOSED', closeHandler);
  }

  once(eventName: string, listener: any): this {
    super.on(eventName, listener);
    return this;
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

  clear(): Promise<void> {
    return Promise.resolve();
  }

  setEventLoopReadSpeed(timeout: number = 0): void {
    Logger.warn('Invoked legacy/depricated method "setEventLoopReadSpeed"!', this.className);
  }

  receiveMessage(msg: string, timeout: number = 500): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer: NodeJS.Timeout = setTimeout(() => {
        try {
          this.removeAllListeners(msg);
          reject(`Request has timed out! ${msg} ${timeout}`);
        } finally {
          clearTimeout(timer);
        }
      }, timeout);

      const messageHandler: Function = (res: Message) => {
        clearTimeout(timer);
        this.removeListener('ERROR', errorHandler);
        resolve(res);
      };

      const errorHandler: Function = (error: Error) => {
        clearTimeout(timer);
        this.removeListener(msg, messageHandler);
        reject(error);
      };

      this.once(msg, messageHandler);
      this.once('ERROR', errorHandler);
    });
  }

  /**
   * This method is no longer supported! Legacy.
   *
   * @memberof NodeUsbTransport
   */
   read(receiveMsg: string = 'unknown', timeout: number = 500): Promise<any> {
    Logger.warn('Invoked legacy/depricated method "read"!', this.className);
    throw new Error('Method "read" is no longer supported! Please use "receiveMessage" instead.');
  }

  write(cmd: string, payload: any = Buffer.alloc(0)): Promise<any> {
    const encodedMsgBuffer: Buffer = MessagePacket.createMessage(cmd, payload);
    return this.transfer(encodedMsgBuffer);
  }

  subscribe(command: string): Promise<any> {
    return this.write('hlink-mb-subscribe', command);
  }

  unsubscribe(command: string): Promise<any> {
    return this.write('hlink-mb-unsubscribe', command);
  }


  async stopUsbEndpointPoll(): Promise<void> {
    if (this.inEndpoint && !this.inEndpoint.pollActive) {
      this.isPollingActive = false;
      return;
    }
    return new Promise((resolve, reject) => {
      this.inEndpoint.stopPoll(() => {
        this.isPollingActive = false;
        resolve();
      });
      this.inEndpoint.once('error', (error: any) => {
        Logger.error('Unable to stop poll!', error, this.className);
        reject(error);
      });
    });
  }

  async stopEventLoop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.removeAllListeners();
      if (this.isPollingActive) {
        this.stopUsbEndpointPoll()
        .then(_ => resolve())
        .catch(e => reject(e));
      } else {
        resolve();
      }
    });
  }

  async releaseEndpoints(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.vscInterface) {
        this.stopUsbEndpointPoll()
        .then(() => {
          this.vscInterface.release(true, (err: usb.LibUSBException) => {
            if (err) return reject(`Unable to release vsc interface! Error: ${err.name}`);
            resolve();
          });
        })
        .catch(e => reject(e));
      } else {
        resolve();
      }
    });
  }

  /**
   * This method is no longer supported! Legacy.
   *
   * @memberof NodeUsbTransport
   */
   async receive(): Promise<Buffer> {
    Logger.warn('Invoked legacy/depricated method "receive"!', this.className);
    throw new Error('Method "receive" is no longer supported! Please use "receiveMessage" instead.');
  }

  async transfer(messageBuffer: Buffer) {
    for (let i = 0; i < messageBuffer.length; i += this.MAX_PACKET_SIZE) {
      const chunk = messageBuffer.slice(i, i + this.MAX_PACKET_SIZE);
      await this.sendChunk(chunk);
    }
  }

  async readChunk(packetSize: number = this.MAX_PACKET_SIZE): Promise<any> {
    if (!this.inEndpoint) return Promise.reject('Device inEndpoint not initialized!');
    return new Promise((resolve, reject) => {
      this.inEndpoint.transfer(packetSize, (err: usb.LibUSBException, data: Buffer) => {
        if (err) return reject(`Unable to read data from device! Error: ${err.name}`);
        resolve(data);
      });
    });
  }

  async sendChunk(chunk: Buffer): Promise<void> {
    if (!this.outEndpoint) return Promise.reject('Device outEndpoint not initialized!');
    return new Promise((resolve, reject) => {
      this.outEndpoint.transfer(chunk, (err: usb.LibUSBException, dataSent: number) => {
        if (err) return reject(`Unable to write data to device! Error: ${err.name}`);
        resolve();
      });
    });
  }
  async close(): Promise<any> {
    return new Promise<void>((resolve, reject) => {
      this.releaseEndpoints()
      .then(_ => this.device.close())
      .then(_ => {
        this.ifOpenedAndEndpointsClaimed = false;
        this.emit('CLOSED');
        resolve();
      })
      .catch(reject);
    });
  }

  async performHlinkHandshake(): Promise<void> {
    const cmds: Promise<any>[]  = [];
    cmds.push(this.sendChunk(Buffer.from([])));
    cmds.push(this.sendChunk(Buffer.from([])));
    cmds.push(this.sendChunk(Buffer.from([0])));
    cmds.push(this.readChunk(1024));
    const [, , , res] = await Promise.all(cmds);
    const decodedMsg: string = Buffer.from(res).toString('utf8');

    const expected: string = 'HLink v0';
    if (decodedMsg !== expected) {
      const message: string = `Hlink handshake has failed! Wrong version. Expected ${expected}, got ${decodedMsg}.`;
      Logger.warn(message, this.className);
      return Promise.reject(message);
    }
    return Promise.resolve();
  }
}
