import IHuddlyDeviceAPI from '@huddly/sdk/lib/src/interfaces/iHuddlyDeviceAPI';
import NodeUsbTransport from './transport';
import { EventEmitter } from 'events';
import IUVCControlAPI from '@huddly/sdk/lib/src/interfaces/iUVCControlApi';
import ITransport from '@huddly/sdk/lib/src/interfaces/iTransport';
import DeviceDiscoveryManager from './manager';
import IDeviceDiscovery from '@huddly/sdk/lib/src/interfaces/iDeviceDiscovery';
import DefaultLogger from './logger';

export default class HuddlyDeviceAPIUSB implements IHuddlyDeviceAPI {
  logger: any;
  serialNumber: any;
  eventEmitter: EventEmitter;
  deviceDiscoveryManager: DeviceDiscoveryManager;

  constructor(logger: any, serialNumber?: any, manager?: any) {
    this.serialNumber = serialNumber;
    this.logger = logger ? logger : new DefaultLogger();
    this.deviceDiscoveryManager = manager ? manager : new DeviceDiscoveryManager();
  }

  async initialize() {
    const deviceList = await this.deviceDiscoveryManager.deviceList();

    deviceList.forEach(usbDevice => {
      if (this.eventEmitter) {
        this.eventEmitter.emit('ATTACH', usbDevice);
      }
    });
  }

  registerForHotplugEvents(eventEmitter: EventEmitter): void {
    this.eventEmitter = eventEmitter;
    this.deviceDiscoveryManager.registerForHotplugEvents(eventEmitter);
  }

  async getDeviceDiscoveryAPI(): Promise<IDeviceDiscovery> {
    return this.deviceDiscoveryManager;
  }

  async getValidatedTransport(device): Promise<ITransport> {
    try {
      const transport = await this.getTransport(device);
      await transport.performHlinkHandshake();
      this.logger.info(':::::::::::: Transport Protocol is HLINK ::::::::::::');
      return transport;
    } catch (e) {
      this.logger.warn(`HLink is not supported for device: ${device.serialNumber}`);
      return undefined;
    }
  }

  async getTransport(device): Promise<NodeUsbTransport> {
    const usbDevice = await this.deviceDiscoveryManager.getDevice(device.serialNumber);
    const transport = new NodeUsbTransport(usbDevice, this.logger);
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
