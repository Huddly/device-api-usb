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

export default class HuddlyDeviceAPIUSB implements IHuddlyDeviceAPI {
  private readonly className: string = 'Device-API-USB';
  eventEmitter: EventEmitter;
  deviceDiscoveryManager: DeviceDiscoveryManager;
  maxSearchRetries: Number;
  alwaysRetry: boolean;

  constructor(opts: DeviceApiOpts = {}) {
    this.deviceDiscoveryManager = opts.manager || new DeviceDiscoveryManager();
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
    if (
      [HuddlyHEX.GO_PID, HuddlyHEX.L1_PID, HuddlyHEX.BASE_PID].includes(
        (device as any as UsbDevice).productId
      )
    ) {
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
      Logger.error(
        `HLink is not supported for device: ${(device as any as UsbDevice).serialNumber}`,
        e,
        this.className
      );
      return undefined;
    }
  }

  async getTransport(device: usb.Device): Promise<NodeUsbTransport> {
    const transport = new NodeUsbTransport(device);
    await transport.init();
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
