import { usb, getDeviceList } from 'usb';
import EventEmitter from 'events';

import IDeviceDiscovery from '@huddly/sdk-interfaces/lib/interfaces/IDeviceDiscovery';
import HuddlyHEX from '@huddly/sdk-interfaces/lib/enums/HuddlyHex';
import Logger from '@huddly/sdk-interfaces/lib/statics/Logger';

interface UsbDevice {
  id: string;
  busNumber: number;
  deviceAddress: number;
  portNumbers: Array<number>;
  interfaces: any;
  serialNumber: string;
  productName: string;
  productId: string;
  vendorId: string;
}
export default class DeviceDiscoveryManager implements IDeviceDiscovery {
  private attachedDevices: Array<UsbDevice> = [];
  private eventEmitter: EventEmitter;

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

  private getDeviceUUID(device: usb.Device): string {
    const uid = this.generateUsbUniqueId({
      usbBusNumber: device.busNumber,
      usbDeviceAddress: device.deviceAddress,
      usbPortNumbers: device.portNumbers
    });
    return uid;
  }

  private async fetchAndPopulateDeviceParams(device: usb.Device): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        device.open();
        device.getStringDescriptor(device.deviceDescriptor.iSerialNumber, (err: usb.LibUSBException, serialNo: string) => {
          if (err) return reject(err);
          device.getStringDescriptor(device.deviceDescriptor.iProduct, (err, productName) => {
            if (err) return reject(err);

            device['id'] = this.getDeviceUUID(device);
            device['serialNumber'] = serialNo;
            device['productName'] = productName;
            device['productId'] = device.deviceDescriptor.idProduct;
            device['vendorId'] = device.deviceDescriptor.idVendor;
            device.close();
            resolve(true);
          });
        });
      } catch (e) {
        if (e.errno === usb.LIBUSB_ERROR_ACCESS) {
          console.warn('Usb device is occupied by a different process!');
          return resolve(false);
        }

        Logger.warn(`Unable to fetch device parameters from usb descriptor! ${e}`);
        reject(`Unable to fetch device parameters from usb descriptor! ${e}`);
      }
    });
  }

  printAttachedDevices(): void {
    console.group('Attached Devices')
    if (this.attachedDevices.length === 0) {
      console.log('[]');
    }
    this.attachedDevices.forEach((dev: UsbDevice) => console.log(`${dev.id}: ${dev.serialNumber}`));
    console.groupEnd();
  }
  private newDeviceAttached(device: UsbDevice): void {
    this.attachedDevices.push(device);
  }

  private newDeviceDetached(detachedDev: UsbDevice): void {
    this.attachedDevices = this.attachedDevices.filter((device: UsbDevice) => device.id !== detachedDev.id);
  }

  private isDeviceWithUUIDCached(uuid: string): boolean {
    return this.attachedDevices.some((dev) => dev.id === uuid);
  }

  registerForHotplugEvents(eventEmitter: EventEmitter): void {
    this.eventEmitter = eventEmitter;
    usb.on('attach', async (device: usb.Device) => {
      if (device.deviceDescriptor.idVendor === HuddlyHEX.VID && await this.fetchAndPopulateDeviceParams(device)) {
        this.newDeviceAttached(device as unknown as UsbDevice);
        Logger.debug(`Got ATTACH event from device with serial ${(device as unknown as UsbDevice).serialNumber}`, 'Device API USB Manager');
        this.eventEmitter.emit('ATTACH', device);
      }
    });

    usb.on('detach', (device: usb.Device) => {
      if (device.deviceDescriptor.idVendor === HuddlyHEX.VID) {
        Logger.debug(`Got DETACH event from device with serial ${(device as unknown as UsbDevice).serialNumber}`, 'Device API USB Manager');
        this.newDeviceDetached(device as unknown as UsbDevice);
        this.eventEmitter.emit('DETACH', device);
      }
    });
  }

  async deviceList(doEmitNewDevices: boolean = false): Promise<usb.Device[]> {
    const usbDevices: usb.Device[] = getDeviceList();
    const devices: usb.Device[] = usbDevices.filter((dev: usb.Device) => dev.deviceDescriptor.idVendor === HuddlyHEX.VID);
    let elidgableDevices: usb.Device[] = [];
    for (let idx = 0; idx < devices.length; idx++) {
      const uuid: string = this.getDeviceUUID(devices[idx]);
      if (!this.isDeviceWithUUIDCached(uuid) && await this.fetchAndPopulateDeviceParams(devices[idx])) {
        this.newDeviceAttached(devices[idx] as unknown as UsbDevice);
        // We assume that the device "Detach" event will take care of clearing up the device cache list
        elidgableDevices.push(devices[idx]);
        if (doEmitNewDevices) {
          this.eventEmitter.emit('ATTACH', devices[idx]);
        }
      }
    }
    return elidgableDevices;
  }

  async getDevice(serialNumber: string | undefined): Promise<usb.Device | undefined> {
    const devices: usb.Device[] = await this.deviceList();
    Logger.debug(
      `DeviceList found ${devices.length} enumerated Huddly devices`,
      'Device API USB Manager'
    );

    if (serialNumber) {
      Logger.debug(
        `Filtering the devices for the following serial number: ${serialNumber}`,
        'Device API USB Manager'
      );
      return devices.find((element: usb.Device) => (element as unknown as UsbDevice).serialNumber == serialNumber);
    } else if (devices.length > 0) {
      if (devices.length !== 1) {
        Logger.warn(
          // @ts-ignore
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
