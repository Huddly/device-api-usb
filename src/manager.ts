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

  private generateUsbUniqueId(props: { usbBusNumber: number, usbDeviceAddress: number, usbPortNumbers: Array<Number> }): string {
    const stringCombo = String(props.usbBusNumber).concat(String(props.usbDeviceAddress).concat(props.usbPortNumbers.toString()));
    let hash = 0;
    for (let i = 0; i < stringCombo.length; i++) {
      const char = stringCombo.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  private getCachedDevice(device: any): any {
    return this.attachedDevices.find((dev) => dev.id === device.id);
  }

  registerForHotplugEvents(eventEmitter: EventEmitter): void {
    this.eventEmitter = eventEmitter;
    this.discoverCameras();
  }

  private getDeviceObject(device: any) {
    //Todo: do something that makes sense here

    const uid = this.generateUsbUniqueId({
      usbBusNumber: device.location[0],
      usbDeviceAddress: device.location[1],
      usbPortNumbers: device.location[0],
    });

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

    return {
      ...device,
      id: uid,
      productId: device.pid,
      productName: name,
    };
  }

  private isDeviceCached(device: any): boolean {
    return this.attachedDevices.some((dev) => dev.id === device.id || dev.serialNumber === device.serialNumber);
  }

  private updateCache(newDevices: Array<any>, removedDevice: Array<any>): void {
    newDevices.forEach(newDevice => this.attachedDevices.push(newDevice));
    removedDevice.forEach(removedDevice => {
      this.attachedDevices = this.attachedDevices.filter(
        device => device.id !== removedDevice.id
      );
    });
  }

  destroy(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  discoverCameras(): void {
    BulkUsb.onAttach(this.deviceAttached.bind(this));
  }

  private deviceAttached(attachedDevice): void {
    if (attachedDevice.vid !== this.HUDDLY_VID) {
      return;
    }
    const newDevice = this.getDeviceObject(attachedDevice);
    newDevice.onDetach(this.deviceDetached.bind(this));
    this.updateCache([newDevice], []);
    this.eventEmitter.emit('ATTACH', newDevice);
  }

  private deviceDetached(removedDevice): void {
    if (removedDevice.vid !== this.HUDDLY_VID) {
      return;
    }
    this.updateCache([], [removedDevice]);
    this.eventEmitter.emit('DETACH', removedDevice.serial);
  }

  async deviceList(): Promise<any> {
    return { devices: this.attachedDevices, newDevices: [], removedDevices: [] };
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
