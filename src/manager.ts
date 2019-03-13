import BulkUsb from './bulkusbdevice';
import EventEmitter from 'events';
import IDeviceDiscovery from '@huddly/sdk/lib/src/interfaces/iDeviceDiscovery';
import Logger from './logger';
import { IDevice, ILogger } from './types';

export default class DeviceDiscoveryManager implements IDeviceDiscovery {
  readonly HUDDLY_VID: number = 0x2bd9;
  private attachedDevices: Array<IDevice> = [];
  eventEmitter: EventEmitter;
  logger: ILogger;

  constructor(logger: ILogger) {
    this.logger = logger || new Logger(true);
  }

  registerForHotplugEvents(eventEmitter: EventEmitter): void {
    this.eventEmitter = eventEmitter;
    this.discoverCameras();
  }

  private updateCache(newDevices: Array<IDevice>, removedDevice: Array<IDevice>): void {
    newDevices.forEach(newDevice => this.attachedDevices.push(newDevice));
    removedDevice.forEach(removedDevice => {
      this.attachedDevices = this.attachedDevices.filter(
        device => device.equals(removedDevice)
      );
    });
  }

  discoverCameras(): void {
    BulkUsb.onAttach(this.deviceAttached.bind(this));
  }

  private deviceAttached(attachedDevice: IDevice): void {
    if (attachedDevice.vid !== this.HUDDLY_VID) {
      return;
    }
    attachedDevice.onDetach(this.deviceDetached.bind(this));
    this.updateCache([attachedDevice], []);
    this.eventEmitter.emit('ATTACH', attachedDevice);
  }

  private deviceDetached(removedDevice: IDevice): void {
    if (removedDevice.vid !== this.HUDDLY_VID) {
      return;
    }
    this.updateCache([], [removedDevice]);
    this.eventEmitter.emit('DETACH', removedDevice.serial);
  }

  async deviceList(): Promise<{devices: IDevice[], newDevices: IDevice[], removedDevices: IDevice[]}> {
    return { devices: this.attachedDevices, newDevices: [], removedDevices: [] };
  }

  async getDevice(serialNumber: any): Promise<IDevice> {
    const { devices } = await this.deviceList();

    let myDevice: IDevice;
    if (serialNumber) {
      myDevice = devices.find(d => d.serial.indexOf(serialNumber) >= 0);
    } else if (devices.length > 0) {
      myDevice = devices[0];
    }

    return myDevice;
  }
}
