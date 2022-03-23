import { EventEmitter } from 'events';
import { usb } from 'usb';
import { Endpoint, InEndpoint, OutEndpoint } from 'usb/dist/usb/endpoint';
import { Interface } from 'usb/dist/usb/interface';

import ITransport from '@huddly/sdk-interfaces/lib/interfaces/ITransport';
import Logger from '@huddly/sdk-interfaces/lib/statics/Logger';

import MessagePacket, { Message } from './messagepacket';
import { LibUSBException } from 'usb/dist/usb';

export default class NodeUsbTransport extends EventEmitter implements ITransport {
  private readonly MAX_PACKET_SIZE: number = 16 * 1024;
  private readonly VSC_INTERFACE_CLASS = 255; // Vendor Specifc Class
  private readonly READ_STATES = Object.freeze({
    NEW_READ: 'new_read',
    PENDING_CHUNK: 'pending_chunk',
  });
  private readonly className: string = 'Device-API-USB Transport';
  private _device: usb.Device;
  private isPollingActive: boolean = false;
  private hlinkProtocolVersion: string = 'HLink v0';

  /***** Read Event Loop Helper Variables ******/
  private readLoopChunks: Buffer[] = [];
  private currentBufferReadSize: number;
  private expectedReadBufferSize: number;
  private currentStateOfReadLoop: String;

  /**
   * A boolean representation of the device being opened and its corresponding
   * vsc interface claimed for channeling the communication.
   *
   * @private
   * @type {boolean}
   * @memberof NodeUsbTransport
   */
  private deviceClaimed: boolean = false;

  vscInterface: Interface;
  inEndpoint: InEndpoint;
  outEndpoint: OutEndpoint;

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

  constructor(device: usb.Device) {
    super();
    this._device = device;
    super.setMaxListeners(50);
  }

  init(): Promise<void> {
    if (this.deviceClaimed) {
      return;
    }

    let opened: boolean = false;
    return new Promise(async (resolve, reject) => {
      try {
        this.device.open();
        opened = true;
        const vscInterface: Interface = this.device.interfaces.find(
          (ifc: Interface) => ifc.descriptor.bInterfaceClass === this.VSC_INTERFACE_CLASS
        );
        if (!vscInterface) return reject('No VSC Interface present on the usb device!');

        this.vscInterface = vscInterface;
        this.vscInterface.claim();
        this.inEndpoint = this.vscInterface.endpoints.find(
          (endpoint: Endpoint) => endpoint instanceof InEndpoint
        ) as InEndpoint;
        this.outEndpoint = this.vscInterface.endpoints.find(
          (endpoint: Endpoint) => endpoint instanceof OutEndpoint
        ) as OutEndpoint;

        this.deviceClaimed = true;
        resolve();
      } catch (err) {
        if (opened) {
          await this.close();
        }

        if (err.errno === usb.LIBUSB_ERROR_ACCESS) {
          Logger.warn(
            'Unable to claim usb interface. Please make sure the device is not used by another process!',
            this.className
          );
          return reject(
            `Unable to claim usb interface. Please make sure the device is not used by another process!`
          );
        }

        Logger.warn('Unable to initialize NodeUsbTransport!', this.className);
        return reject(err);
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

  async performHlinkHandshake(): Promise<void> {
    await this.sendChunk(Buffer.alloc(0));
    await this.sendChunk(Buffer.alloc(1, 0x00));
    const res = await this.readChunk(1024);
    const decodedMsg = res.toString('utf8');
    if (decodedMsg !== this.hlinkProtocolVersion) {
      const message: string = `Hlink handshake has failed! Wrong version. Expected ${this.hlinkProtocolVersion}, got ${decodedMsg}.`;
      return Promise.reject(message);
    }
    return Promise.resolve();
  }

  readLoopReset(): void {
    this.readLoopChunks.splice(0, this.readLoopChunks.length);
    this.currentBufferReadSize = 0;
    this.expectedReadBufferSize = -1;
    this.currentStateOfReadLoop = this.READ_STATES.NEW_READ;
  }

  private parseAndEmitFullyRetrievedMessage(): void {
    const finalBuffer: Buffer = Buffer.concat(this.readLoopChunks);
    const result: Message = MessagePacket.parseMessage(finalBuffer);
    this.emit(result.message, result);
    this.readLoopReset();
  }

  private continueReadLogic(): void {
    if (this.currentBufferReadSize < this.expectedReadBufferSize) {
      this.currentStateOfReadLoop = this.READ_STATES.PENDING_CHUNK;
    } else {
      this.parseAndEmitFullyRetrievedMessage();
    }
  }

  private onDataRetrievedHandler(buffer: Buffer): void {
    if (this.currentStateOfReadLoop === this.READ_STATES.NEW_READ) {
      if (buffer.length < MessagePacket.HEADER_SIZES.HDR_SIZE) {
        this.inEndpoint?.removeListener('data', this.onDataRetrievedHandler);
        if (buffer.length === 8 && buffer.toString('utf8') === this.hlinkProtocolVersion) {
          throw new Error('Received a hlink reset sequence. Read loop cannot continue!');
        }

        throw new Error(
          `Received an incomplete message on start of read! Message size: ${buffer.length}. Unable to proceed, exiting ungracefully!`
        );
      }

      this.expectedReadBufferSize = MessagePacket.parseMessage(buffer).totalSize();
      this.readLoopChunks = [buffer];
      this.currentBufferReadSize = buffer.length;
      this.continueReadLogic();
    } else {
      this.readLoopChunks.push(Buffer.from(buffer));
      this.currentBufferReadSize += buffer.length;
      this.continueReadLogic();
    }
  }

  startListen(): void {
    this.readLoopReset();

    const closeHandler: Function = () => {
      Logger.debug('Removing transport data event subscription.', this.className);
      this.inEndpoint?.removeListener('data', this.onDataRetrievedHandler);
    };

    const errorHandler: any = (error: LibUSBException) => {
      if (error.errno != usb.LIBUSB_TRANSFER_NO_DEVICE) {
        Logger.error(`Received error message on read loop!`, error, this.className);
      }
      this.close();
    };

    // Setup event handlers
    this.inEndpoint.on('data', this.onDataRetrievedHandler.bind(this));
    this.inEndpoint.once('error', errorHandler);
    this.once('ERROR', errorHandler);
    this.once('CLOSED', closeHandler);
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

  write(cmd: string, payload: any = Buffer.alloc(0)): Promise<any> {
    const encodedMsgBuffer: Buffer = MessagePacket.createMessage(cmd, payload);
    return new Promise<void>((resolve, reject) => {
      this.sendChunk(encodedMsgBuffer)
        .then((_) => resolve())
        .catch((e: Error) => {
          if (
            e.message.includes('LIBUSB_ERROR_IO') &&
            encodedMsgBuffer.length > this.MAX_PACKET_SIZE
          ) {
            this.splitAndSendPayloadInChunks(encodedMsgBuffer)
              .then((_) => resolve())
              .catch((e) => reject(e));
          } else {
            reject(e);
          }
        });
    });
  }

  async splitAndSendPayloadInChunks(payload: Buffer): Promise<void> {
    for (let i = 0; i < payload.length; i += this.MAX_PACKET_SIZE) {
      const chunk = payload.slice(i, i + this.MAX_PACKET_SIZE);
      await this.sendChunk(chunk);
    }
  }

  subscribe(command: string): Promise<any> {
    return this.write('hlink-mb-subscribe', command);
  }

  unsubscribe(command: string): Promise<any> {
    return this.write('hlink-mb-unsubscribe', command);
  }

  async readChunk(packetSize: number = this.MAX_PACKET_SIZE): Promise<any> {
    if (!this.inEndpoint) return Promise.reject('Device inEndpoint not initialized!');
    return new Promise((resolve, reject) => {
      this.inEndpoint.transfer(packetSize, (err: usb.LibUSBException, data: Buffer) => {
        if (err)
          return reject(
            new Error(
              `Unable to read data from device (LibUSBException: ${err.errno})! ${err.message}`
            )
          );
        resolve(data);
      });
    });
  }

  async sendChunk(chunk: Buffer): Promise<void> {
    if (!this.outEndpoint) return Promise.reject('Device outEndpoint not initialized!');
    return new Promise((resolve, reject) => {
      this.outEndpoint.transfer(chunk, (err: usb.LibUSBException) => {
        if (err)
          return reject(
            new Error(
              `Unable to write data to device (LibUSBException: ${err.errno})! ${err.message}`
            )
          );
        resolve();
      });
    });
  }

  /********* Teardown Methods *********/
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
      this.inEndpoint.once('error', (error: usb.LibUSBException) => {
        if (error.errno != usb.LIBUSB_TRANSFER_NO_DEVICE) {
          Logger.error('Unable to stop poll!', error, this.className);
          reject(error);
        }
      });
    });
  }

  async stopEventLoop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.removeAllListeners();
      if (this.isPollingActive) {
        this.stopUsbEndpointPoll()
          .then((_) => resolve())
          .catch((e) => reject(e));
      } else {
        resolve();
      }
    });
  }

  async releaseEndpoints(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.deviceClaimed) {
        this.stopUsbEndpointPoll()
          .then(() => {
            this.vscInterface.release(true, (err: usb.LibUSBException) => {
              if (err) {
                if (err.errno !== usb.LIBUSB_ERROR_NO_DEVICE)
                  // Ignore LIBUSB_ERROR_NO_DEVICE since we are releasing/closing device already
                  return reject(
                    `Unable to release vsc interface! UsbError: ${err.errno} \n${
                      err.stack || err.message
                    }`
                  );
              }
              resolve();
            });
          })
          .catch((e) => reject(e));
      } else {
        resolve();
      }
    });
  }

  async close(): Promise<any> {
    if (!this.deviceClaimed) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      this.releaseEndpoints()
        .then((_) => {
          try {
            this.device.close();
          } catch {}
        })
        .then((_) => {
          this.deviceClaimed = false;
          this.emit('CLOSED');
          resolve();
        })
        .catch(reject);
    });
  }

  /********* EventEmitter Overrides *********/
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

  /********* DEPRICATED/LEGACY METHODS *********/
  receive(): Promise<Buffer> {
    throw new Error(
      'Method "receive" is no longer supported! Please use "receiveMessage" instead.'
    );
  }

  read(receiveMsg: string = 'unknown', timeout: number = 500): Promise<any> {
    throw new Error('Method "read" is no longer supported! Please use "receiveMessage" instead.');
  }

  setEventLoopReadSpeed(timeout: number = 0): void {}

  clear(): Promise<void> {
    return Promise.resolve();
  }
}
