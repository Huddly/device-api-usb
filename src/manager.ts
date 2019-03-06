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
    this.logger.warn('Node-USB Hotplug Events not supported on this machine. Falling back to discovery poll!');
    this.pollInterval = setInterval(() => this.discoverCameras(), 1000);
  }

  private setDeviceUid(device: any) {
    const uid = this.generateUsbUniqueId({
      usbBusNumber: 1, //device.busNumber,
      usbDeviceAddress: 2, //device.deviceAddress,
      usbPortNumbers: [3] //device.portNumbers
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

  async discoverCameras(): Promise<void> {
    const { newDevices, removedDevices } = await this.deviceList();
    newDevices.forEach(newDevice => this.eventEmitter.emit('ATTACH', newDevice));
    removedDevices.forEach(removedDevice => this.eventEmitter.emit('DETACH', removedDevice.serialNumber));
  }

  async deviceList(): Promise<any> {
    let removedDevices = [];
    const isAllAttached = this.attachedDevices.every(d => d.isAttached);
    if (this.attachedDevices.length > 0 && isAllAttached) {
      return Promise.resolve({
        devices: this.attachedDevices,
        newDevices: [],
        removedDevices: [],
      });
    }

    removedDevices = this.attachedDevices.filter(d => !d.isAttached);
    const devices =  await BulkUsb.getDeviceList();

    const usbDevices = devices
    .filter(d => d.vid === 0x2bd9);

    const newDevices = [];
    for (let idx = 0; idx < usbDevices.length; idx++) {
      const usbDevice = usbDevices[idx];
      usbDevice.isAttached = true;
      this.setDeviceUid(usbDevice);
      // if (!this.isDeviceCached(usbDevice)) {
        newDevices.push(usbDevice);
      // }
    }

    // newDevices.forEach(d => d.onAttach(this.eventEmitter.emit('DETACH', d.serialNumber)));

    // const removedDevices = this.attachedDevices.filter(({ id, serialNumber }) => {
    //   return usbDevices.every((device) => device.serialNumber !== serialNumber);
    // });

    this.updateCache(newDevices, removedDevices);
    return { devices: usbDevices, newDevices: newDevices, removedDevices: removedDevices };
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
