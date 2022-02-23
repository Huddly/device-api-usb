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


  vscInterface: Interface;
  inEndpoint: InEndpoint;
  outEndpoint: OutEndpoint;

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
    let claimed: boolean, opened: boolean = false;
    return new Promise(async (resolve, reject) => {
      try {
        this.device.open();
        opened = true;
        let vscInterface: Interface = this.device.interfaces.find((ifc: Interface) => (ifc.descriptor.bInterfaceClass === this.VSC_INTERFACE_CLASS));
        if (!vscInterface) return reject('No VSC Interface present on the usb device!');

        this.vscInterface = vscInterface;
        this.vscInterface.claim();
        claimed = true;
        this.inEndpoint = this.vscInterface.endpoints.find((endpoint: Endpoint) => (endpoint instanceof InEndpoint)) as InEndpoint;
        this.outEndpoint = this.vscInterface.endpoints.find((endpoint: Endpoint) => (endpoint instanceof OutEndpoint)) as OutEndpoint;
        resolve();
      } catch (err) {
        if (opened) {
          await this.close();
        }

        if (err.errno === usb.LIBUSB_ERROR_ACCESS) {
          Logger.warn('Unable to claim usb interface. Please make sure the device is not used by another process!');
          return reject(`Unable to claim usb interface. Please make sure the device is not used by another process!`);
        }

        Logger.warn('Error Occurred claiming interface!');
        return reject(`Error Occurred claiming interface! ${err}`);
      }
    });
  }

  running: boolean = false;

  initEventLoop(): void {
    this.inEndpoint.startPoll(1, this.MAX_PACKET_SIZE);
    this.running = true;
    this.startListen();
  }

  async handleResetSeqRead(): Promise<void> {
    await this.stopEventLoop();
    await this.close();
    this.emit('TRANSPORT_RESET');
  }

  calculateExpectedReadSize(chunk: Message): number {
    return MessagePacket.HEADER_SIZES.HDR_SIZE + chunk.messageSize + chunk.payloadSize;
  }

  startListen(): void {
    if (!this.running) {
      return;
    }

    const chunks: Buffer[] = [];
    let currentSize: number = 0;
    let expectedSize: number = -1;
    let currentState: string = this.READ_STATES.NEW_READ;

    const parseAndEmitCompleteMessage = () => {
      currentState = this.READ_STATES.NEW_READ;
      const finalBuffer: Buffer = Buffer.concat(chunks, currentSize);
      const result: Message = MessagePacket.parseMessage(finalBuffer);
      chunks.splice(0, chunks.length); // Empty the array
      currentSize = 0;
      this.emit(result.message, result);
    }

    const continueReadLogic = () => {
      if (currentSize < expectedSize) {
        currentState = this.READ_STATES.PENDING_CHUNK;
      } else {
        parseAndEmitCompleteMessage();
      }
    };

    // Setup data event listener
    this.inEndpoint.on('data', (buffer: Buffer) => {
      if (currentState === this.READ_STATES.NEW_READ) {
        if (buffer.length < MessagePacket.HEADER_SIZES.HDR_SIZE) {
          this.handleResetSeqRead();
          return;
        }
        chunks.push(buffer);
        currentSize += buffer.length;
        const parsedChunk: Message = MessagePacket.parseMessage(buffer);
        expectedSize = this.calculateExpectedReadSize(parsedChunk);
        continueReadLogic();
      } else {
        chunks.push(buffer);
        currentSize += buffer.length;
        continueReadLogic();
      }
    });

    // Setup error event listener
    this.inEndpoint.once('error', (error: usb.LibUSBException) => {
      Logger.error(`Received error message on read loop!`, error, 'Device-API-USB Transport');
      this.close();
    });

    // Setup poll end event listener
    this.inEndpoint.once('end', () => {
      Logger.info('Usb polling has ended!');
    });
  }

  async stopUsbEndpointPoll(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.inEndpoint.stopPoll(() => {
        this.running = false;
        resolve();
      });
      this.inEndpoint.once('error', (error: any) => {
        Logger.error('Unable to stop poll!', error, 'Device-API_USB Transport');
        reject(error);
      });
    })
  }

  async stopEventLoop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.removeAllListeners();
      if (this.running) {
        this.stopUsbEndpointPoll()
        .then(_ => resolve())
        .catch(e => reject(e));
      } else {
        resolve();
      }
    });
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

      const messageHandler = (res: Message) => {
        clearTimeout(timer);
        this.removeListener('ERROR', errorHandler);
        resolve(res);
      };
      const errorHandler = (error) => {
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
    throw new Error('Method no longer supported!');
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
    throw new Error('Depricated Method!');
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
    if (this.device) {
      await this.releaseEndpoints();
      this.device.close();
      this.device = undefined;
    }
    return Promise.resolve();
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
      Logger.warn(message);
      return Promise.reject(message);
    }
    return Promise.resolve();
  }
}
