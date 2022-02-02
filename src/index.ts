import IHuddlyDeviceAPI from '@huddly/sdk-interfaces/lib/interfaces/IHuddlyDeviceAPI';
import IUVCControlAPI from '@huddly/sdk-interfaces/lib/interfaces/IUVCControlApi';
import ITransport from '@huddly/sdk-interfaces/lib/interfaces/ITransport';
import IDeviceDiscovery from '@huddly/sdk-interfaces/lib/interfaces/IDeviceDiscovery';
import DeviceApiOpts from '@huddly/sdk-interfaces/lib/interfaces/IDeviceApiOpts';
import HuddlyHEX from '@huddly/sdk-interfaces/lib/enums/HuddlyHex';
import Logger from '@huddly/sdk-interfaces/lib/statics/Logger';

import NodeUsbTransport from './transport';
import { EventEmitter } from 'events';
import DeviceDiscoveryManager from './manager';

export default class HuddlyDeviceAPIUSB implements IHuddlyDeviceAPI {
  eventEmitter: EventEmitter;
  deviceDiscoveryManager: DeviceDiscoveryManager;
  maxSearchRetries: Number;
  alwaysRetry: boolean;

  private readonly SUPPORTED_DEVICE_PIDS: Number[] = [
    HuddlyHEX.BOXFISH_PID,
    HuddlyHEX.CLOWNFISH_PID,
    HuddlyHEX.DARTFISH_PID,
    HuddlyHEX.DWARFFISH_PID,
  ];

  constructor(opts: DeviceApiOpts = {}) {
    this.deviceDiscoveryManager = opts.manager || new DeviceDiscoveryManager();
    this.maxSearchRetries = opts.maxSearchRetries || 10;
    this.alwaysRetry = opts.alwaysRetry || false;
  }

  async initialize() {}

  registerForHotplugEvents(eventEmitter: EventEmitter): void {
    this.eventEmitter = eventEmitter;
    this.deviceDiscoveryManager.registerForHotplugEvents(eventEmitter);
  }

  async getDeviceDiscoveryAPI(): Promise<IDeviceDiscovery> {
    return this.deviceDiscoveryManager;
  }

  async getValidatedTransport(device): Promise<ITransport> {
    if (!this.SUPPORTED_DEVICE_PIDS.includes(device.productId)) {
      Logger.warn(
        `HLink is not supported for Huddly device with PID ${device.productId}`,
        'Device API USB'
      );
      return undefined;
    }

    try {
      const transport = await this.getTransport(device);
      await transport.performHlinkHandshake();
      Logger.info('Transport Protocol is Hlink', 'Device API USB');
      return transport;
    } catch (e) {
      Logger.error(
        `HLink is not supported for device: ${device.serialNumber}`,
        e,
        'Device API USB'
      );
      return undefined;
    }
  }

  async getTransport(device): Promise<NodeUsbTransport> {
    let usbDevice;

    let i = 0;
    while ((this.alwaysRetry || i < this.maxSearchRetries) && !usbDevice) {
      usbDevice = await this.deviceDiscoveryManager.getDevice(device.serialNumber);
      i++;
    }

    const transport = new NodeUsbTransport(usbDevice);
    await transport.init();
    return transport;
  }

  async isUVCControlsSupported(device) {
    return Promise.resolve(false);
  }

  async getUVCControlAPIForDevice(device): Promise<IUVCControlAPI> {
    throw new Error('UVCControlInterface API not available for node-usb');
  }

  async isHIDSupported(device) {
    return Promise.resolve(false);
  }

  async getHIDAPIForDevice(device): Promise<any> {
    throw new Error('HID Unsupported for device-api usb');
  }
}
