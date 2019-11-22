import BulkUsb, { BulkUsbDevice } from './bulkusbdevice';
import EventEmitter from 'events';
import IDeviceDiscovery from '@huddly/sdk/lib/src/interfaces/iDeviceDiscovery';
import Logger from '@huddly/sdk/lib/src/utilitis/logger';

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
    Object.assign(device, {
      id: device._cookie,
      productId: device.pid,
    });
    return device;
  }

  destroy(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  discoverCameras(): void {}

  private deviceAttached(attachedDevice): void {
    if (attachedDevice.vid !== this.HUDDLY_VID) {
      return;
    }
    const newDevice = this.getDeviceObject(attachedDevice);
    this.logger.debug(
      `Got ATTACH event from device with id ${newDevice.id}`,
      'Device API USB Manager'
    );
    newDevice.onDetach(this.deviceDetached.bind(this));
    this.attachedDevices.push(newDevice);
    this.eventEmitter.emit('ATTACH', newDevice);
  }

  private deviceDetached(removedDevice): void {
    if (removedDevice.vid !== this.HUDDLY_VID) {
      return;
    }
    this.attachedDevices = this.attachedDevices.filter(d => !removedDevice.equals(d));
    this.logger.debug('Got DETACH event from device with id', 'Device API USB Manager');
    this.eventEmitter.emit('DETACH', removedDevice.serialNumber);
  }

  async deviceList(): Promise<{ devices: BulkUsbDevice[] }> {
    // Necessary to do dummy onattach to start device list polling loop
    // To avoid race
    BulkUsb.onAttach(async () => {});
    const allDevices = await BulkUsb.listDevices();
    const devices = allDevices.filter(dev => dev.vid === 0x2bd9);
    return { devices };
  }

  async getDevice(serialNumber: string | undefined): Promise<BulkUsbDevice | undefined> {
    const { devices } = await this.deviceList();
    this.logger.debug(
      `DeviceList found ${devices.length} enumerated Huddly devices`,
      'Device API USB Manager'
    );

    if (serialNumber) {
      this.logger.debug(
        `Filtering the devices for the following serial number: ${serialNumber}`,
        'Device API USB Manager'
      );
      return devices.find(d => d.serialNumber.replace(' ', '_').indexOf(serialNumber) >= 0);
    } else if (devices.length > 0) {
      if (devices.length !== 1) {
        this.logger.warn(
          `Randomly choosing between ${devices.length} Huddly devices (${devices[0].serialNumber})`,
          'Device API USB Manager'
        );
      }
      return devices[0];
    }
    this.logger.warn(
      `Could not find device with serial ${serialNumber} amongst ${devices.length} devices`,
      'Device API USB Manager'
    );
    return undefined;
  }
}
