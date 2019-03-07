import usb from 'usb';
import BulkUsb from 'bulk_usb';
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

  private setDeviceUid(device: any) {
    const uid = this.generateUsbUniqueId({
      usbBusNumber: device.location[0],
      usbDeviceAddress: device.location[1],
      usbPortNumbers: device.location[0],
    });
    device.productId = device.pid;
    device.id = uid;
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

  private deviceAttached(newDevice): void {
    if (newDevice.vid !== 0x2bd9) {
      return;
    }
    this.setDeviceUid(newDevice);
    newDevice.onDetach(this.deviceDetached.bind(this));
    this.updateCache([newDevice], []);
    this.eventEmitter.emit('ATTACH', newDevice);
  }

  private deviceDetached(removedDevice): void {
    this.updateCache([], [removedDevice]);
    this.eventEmitter.emit('DETACH', removedDevice);
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
