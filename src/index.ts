import IHuddlyDeviceAPI from '@huddly/sdk/lib/src/interfaces/iHuddlyDeviceAPI';
import NodeUsbTransport from './transport';
import { EventEmitter } from 'events';
import IUVCControlAPI from '@huddly/sdk/lib/src/interfaces/iUVCControlApi';
import ITransport from '@huddly/sdk/lib/src/interfaces/iTransport';
import IDeviceDiscovery from '@huddly/sdk/lib/src/interfaces/iDeviceDiscovery';
import DeviceApiOpts from '@huddly/sdk/lib/src/interfaces/IDeviceApiOpts';
import DeviceDiscoveryManager from './manager';
import Logger from '@huddly/sdk/lib/src/utilitis/logger';
import {
  HUDDLY_GO_PID,
  HUDDLY_L1_PID,
  HUDDLY_BASE_PID,
} from '@huddly/sdk/lib/src/components/device/factory';

export default class HuddlyDeviceAPIUSB implements IHuddlyDeviceAPI {
  eventEmitter: EventEmitter;
  deviceDiscoveryManager: DeviceDiscoveryManager;
  maxSearchRetries: Number;
  alwaysRetry: boolean;

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
    if ([HUDDLY_GO_PID, HUDDLY_L1_PID, HUDDLY_BASE_PID].includes(device.productId)) {
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
