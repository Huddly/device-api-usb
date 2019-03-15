import BulkUsb from './bulkusbdevice';
import EventEmitter from 'events';
import IDeviceDiscovery from '@huddly/sdk/lib/src/interfaces/iDeviceDiscovery';
import Logger from './logger';

export default class DeviceDiscoveryManager implements IDeviceDiscovery {
  readonly HUDDLY_VID: number = 0x2bd9;
  private attachedDevices: Array<any> = [];
  eventEmitter: EventEmitter;
  logger: any;
  pollInterval: any;

  constructor(logger: any) {
    this.logger = logger || new Logger(true);
  }

  registerForHotplugEvents(eventEmitter: EventEmitter): void {
    this.eventEmitter = eventEmitter;
    BulkUsb.onAttach(this.deviceAttached.bind(this));
  }

  private getDeviceObject(device: any) {
    let name;
    switch (device.pid) {
      case 0x11:
        name = 'Huddly GO';
        break;
      case 0x21:
        name = 'Huddly IQ';
        break;
      default:
        throw new Error('Unknown device');
    }

    Object.assign(device, {
      id: device._cookie,
      productId: device.pid,
      productName: name
    });
    return device;
  }

  destroy(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  discoverCameras(): void {
  }

  private deviceAttached(attachedDevice): void {
    if (attachedDevice.vid !== this.HUDDLY_VID) {
      return;
    }
    const newDevice = this.getDeviceObject(attachedDevice);
    newDevice.onDetach(this.deviceDetached.bind(this));
    this.attachedDevices.push(newDevice);
    this.eventEmitter.emit('ATTACH', newDevice);
  }

  private deviceDetached(removedDevice): void {
    if (removedDevice.vid !== this.HUDDLY_VID) {
      return;
    }
    this.attachedDevices = this.attachedDevices.filter(d => !removedDevice.equals(d));
    this.eventEmitter.emit('DETACH', removedDevice.serialNumber);
  }

  async deviceList(): Promise<any> {
    // Fixme: Do dummy attach to init polling
    BulkUsb.onAttach(async () => {});
    const devices = await BulkUsb.listDevices();
    return { devices };
  }

  async getDevice(serialNumber: any): Promise<any> {
    const { devices } = await this.deviceList();

    let myDevice = undefined;
    if (serialNumber) {
      myDevice = devices.find(d => d.serialNumber.indexOf(serialNumber) >= 0);
    } else if (devices.length > 0) {
      myDevice = devices[0];
    }

    return myDevice;
  }
}
