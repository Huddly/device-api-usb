import IHuddlyDeviceAPI from '@huddly/sdk-interfaces/lib/interfaces/IHuddlyDeviceAPI';
import IUVCControlAPI from '@huddly/sdk-interfaces/lib/interfaces/IUVCControlApi';
import ITransport from '@huddly/sdk-interfaces/lib/interfaces/ITransport';
import IDeviceDiscovery from '@huddly/sdk-interfaces/lib/interfaces/IDeviceDiscovery';
import DeviceApiOpts from '@huddly/sdk-interfaces/lib/interfaces/IDeviceApiOpts';
import HuddlyHEX from '@huddly/sdk-interfaces/lib/enums/HuddlyHex';
import Logger from '@huddly/sdk-interfaces/lib/statics/Logger';

import NodeUsbTransport from './transport';
import { EventEmitter } from 'events';
import DeviceDiscoveryManager, { UsbDevice } from './manager';
import { usb } from 'usb';

export const defaultPidsToIgnore = [
  HuddlyHEX.GO_PID,
  HuddlyHEX.L1_PID,
  HuddlyHEX.S1_PID,
  HuddlyHEX.BASE_PID,
];

export default class HuddlyDeviceAPIUSB implements IHuddlyDeviceAPI {
  private readonly className: string = 'Device-API-USB';
  eventEmitter: EventEmitter;
  deviceDiscoveryManager: DeviceDiscoveryManager;
  maxSearchRetries: Number;
  alwaysRetry: boolean;

  constructor(opts: DeviceApiOpts = {}) {
    this.deviceDiscoveryManager = opts.manager || new DeviceDiscoveryManager(opts.pidsToIgnore);
    this.maxSearchRetries = opts.maxSearchRetries || 10;
    this.alwaysRetry = opts.alwaysRetry || false;
  }

  initialize(): void {
    // Poke discovery manager to check for new devices on the system and fire attach events
    this.deviceDiscoveryManager.deviceList(true);
  }

  registerForHotplugEvents(eventEmitter: EventEmitter): void {
    this.eventEmitter = eventEmitter;
    this.deviceDiscoveryManager.registerForHotplugEvents(eventEmitter);
  }

  async getDeviceDiscoveryAPI(): Promise<IDeviceDiscovery> {
    return this.deviceDiscoveryManager;
  }

  async getValidatedTransport(device: usb.Device): Promise<ITransport> {
    if (defaultPidsToIgnore.includes((device as any as UsbDevice).productId)) {
      Logger.warn(
        `HLink is not supported for Huddly device with PID ${
          (device as any as UsbDevice).productId
        }`,
        this.className
      );
      return undefined;
    }
    try {
      const transport: NodeUsbTransport = await this.getTransport(device);
      await transport.performHlinkHandshake();
      Logger.debug('Transport Protocol is Hlink', this.className);
      return transport;
    } catch (e) {
      Logger.warn(`Transport not supported or handshake failed! ERROR: ${e}`, this.className);
      return undefined;
    }
  }

  async getTransport(device: usb.Device): Promise<NodeUsbTransport> {
    let transport: NodeUsbTransport;
    if (device instanceof usb.Device) {
      transport = new NodeUsbTransport(device);
    } else {
      const otherDevice: UsbDevice = device as UsbDevice;
      if (!otherDevice.serialNumber) {
        const errMsg: string = `Transport cannot be initialized since the provided usb device instance is lacking serial number [${otherDevice.serialNumber}]!`;
        Logger.warn(errMsg, this.className);
        return Promise.reject(errMsg);
      }

      let i = 0;
      let usbDevice: usb.Device;
      while ((this.alwaysRetry || i < this.maxSearchRetries) && !usbDevice) {
        usbDevice = await this.deviceDiscoveryManager.getDevice(otherDevice.serialNumber);
        i++;
      }

      if (!usbDevice) {
        const errMsg: string = `Unable to find usb.Device instance with serial [${otherDevice.serialNumber}] afer ${i} attempts!`;
        Logger.warn(errMsg, this.className);
        return Promise.reject(errMsg);
      }

      transport = new NodeUsbTransport(usbDevice);
    }

    Logger.debug(
      'Usb device instance acquired, initializing transport component...',
      this.className
    );
    await transport.init();
    Logger.debug('Transport component initialized.', this.className);
    return transport;
  }

  async isUVCControlsSupported(device: usb.Device): Promise<boolean> {
    return Promise.resolve(false);
  }

  async getUVCControlAPIForDevice(device: usb.Device): Promise<IUVCControlAPI> {
    throw new Error('UVCControlInterface API not available for node-usb');
  }

  async isHIDSupported(device: usb.Device): Promise<boolean> {
    return Promise.resolve(false);
  }

  async getHIDAPIForDevice(device: usb.Device): Promise<any> {
    throw new Error('HID Unsupported for device-api usb');
  }
}
