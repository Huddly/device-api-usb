import BulkUsb, { BulkUsbDevice } from './bulkusbdevice';
import EventEmitter from 'events';

import IDeviceDiscovery from '@huddly/sdk-interfaces/lib/interfaces/IDeviceDiscovery';
import HuddlyHEX from '@huddly/sdk-interfaces/lib/enums/HuddlyHex';
import Logger from '@huddly/sdk-interfaces/lib/statics/Logger';

export default class DeviceDiscoveryManager implements IDeviceDiscovery {
  private attachedDevices: Array<any> = [];
  eventEmitter: EventEmitter;
  pollInterval: any;

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
    if (attachedDevice.vid !== HuddlyHEX.VID) {
      return;
    }
    const newDevice = this.getDeviceObject(attachedDevice);
    Logger.debug(`Got ATTACH event from device with id ${newDevice.id}`, 'Device API USB Manager');
    newDevice.onDetach(this.deviceDetached.bind(this));
    this.attachedDevices.push(newDevice);
    this.eventEmitter.emit('ATTACH', newDevice);
  }

  private deviceDetached(removedDevice): void {
    if (removedDevice.vid !== HuddlyHEX.VID) {
      return;
    }
    this.attachedDevices = this.attachedDevices.filter((d) => !removedDevice.equals(d));
    Logger.debug('Got DETACH event from device with id', 'Device API USB Manager');
    this.eventEmitter.emit('DETACH', removedDevice.serialNumber);
  }

  async deviceList(): Promise<{ devices: BulkUsbDevice[] }> {
    // Necessary to do dummy onattach to start device list polling loop
    // To avoid race
    BulkUsb.onAttach(async () => {});
    const allDevices = await BulkUsb.listDevices();
    const devices = allDevices.filter((dev) => dev.vid === 0x2bd9);
    return { devices };
  }

  async getDevice(serialNumber: string | undefined): Promise<BulkUsbDevice | undefined> {
    const { devices } = await this.deviceList();
    Logger.debug(
      `DeviceList found ${devices.length} enumerated Huddly devices`,
      'Device API USB Manager'
    );

    if (serialNumber) {
      Logger.debug(
        `Filtering the devices for the following serial number: ${serialNumber}`,
        'Device API USB Manager'
      );
      return devices.find((d) => d.serialNumber.indexOf(serialNumber) >= 0);
    } else if (devices.length > 0) {
      if (devices.length !== 1) {
        Logger.warn(
          `Randomly choosing between ${devices.length} Huddly devices (${devices[0].serialNumber})`,
          'Device API USB Manager'
        );
      }
      return devices[0];
    }
    Logger.warn(
      `Could not find device with serial ${serialNumber} amongst ${devices.length} devices`,
      'Device API USB Manager'
    );
    return undefined;
  }
}
