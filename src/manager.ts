import { usb, getDeviceList } from 'usb';
import EventEmitter from 'events';

import IDeviceDiscovery from '@huddly/sdk-interfaces/lib/interfaces/IDeviceDiscovery';
import HuddlyHEX from '@huddly/sdk-interfaces/lib/enums/HuddlyHex';
import Logger from '@huddly/sdk-interfaces/lib/statics/Logger';

export interface UsbDevice {
  id: string;
  busNumber: number;
  deviceAddress: number;
  portNumbers: Array<number>;
  interfaces: any;
  serialNumber: string;
  productName: string;
  productId: number;
  vendorId: number;
}

export default class DeviceDiscoveryManager implements IDeviceDiscovery {
  private readonly className: string = 'Device-API-USB Manager';
  private attachedDevices: Array<UsbDevice> = [];
  private eventEmitter: EventEmitter;

  private generateUsbUniqueId(props: {
    usbBusNumber: number;
    usbDeviceAddress: number;
    usbPortNumbers: Array<Number>;
  }): string {
    const stringCombo: String = String(props.usbBusNumber).concat(
      String(props.usbDeviceAddress).concat(props.usbPortNumbers.toString())
    );
    let hash = 0;
    for (let i = 0; i < stringCombo.length; i++) {
      const char = stringCombo.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  private getDeviceUUID(device: usb.Device): string {
    const uid: string = this.generateUsbUniqueId({
      usbBusNumber: device.busNumber,
      usbDeviceAddress: device.deviceAddress,
      usbPortNumbers: device.portNumbers,
    });
    return uid;
  }

  private async fetchAndPopulateDeviceParams(device: usb.Device): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        device.open();
        device.getStringDescriptor(
          device.deviceDescriptor.iSerialNumber,
          (err: usb.LibUSBException, serialNo: string) => {
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
          }
        );
      } catch (e) {
        if (e.errno === usb.LIBUSB_ERROR_ACCESS) {
          Logger.warn(
            `Unable to open usb device. Device occupied by another process!`,
            this.className
          );
          return resolve(false); // We assume that a different SDK process is using this device. We don't fail here.
        }

        Logger.warn(`Unable to fetch device parameters from usb descriptor! ${e}`, this.className);
        reject(`Unable to fetch device parameters from usb descriptor! ${e}`);
      }
    });
  }

  private newDeviceAttached(device: UsbDevice): void {
    this.attachedDevices.push(device);
  }

  private newDeviceDetached(detachedDev: UsbDevice): void {
    this.attachedDevices = this.attachedDevices.filter(
      (device: UsbDevice) => device.id !== detachedDev.id
    );
  }

  private isDeviceWithUUIDCached(uuid: string): boolean {
    return this.attachedDevices.some((dev) => dev.id === uuid);
  }

  printAttachedDevices(): void {
    console.group('Attached Devices');
    if (this.attachedDevices.length === 0) {
      console.log('[]');
    }
    this.attachedDevices.forEach((dev: UsbDevice) => console.log(`${dev.id}: ${dev.serialNumber}`));
    console.groupEnd();
  }

  registerForHotplugEvents(eventEmitter: EventEmitter): void {
    this.eventEmitter = eventEmitter;
    usb.on('attach', async (device: usb.Device) => {
      if (
        device.deviceDescriptor.idVendor === HuddlyHEX.VID &&
        (await this.fetchAndPopulateDeviceParams(device))
      ) {
        this.newDeviceAttached(device as any as UsbDevice);
        Logger.debug(
          `Got ATTACH event from device with serial ${(device as any as UsbDevice).serialNumber}`,
          this.className
        );
        this.eventEmitter.emit('ATTACH', device);
      }
    });

    usb.on('detach', (device: usb.Device) => {
      if (device.deviceDescriptor.idVendor === HuddlyHEX.VID) {
        Logger.debug(
          `Got DETACH event from device with serial ${(device as any as UsbDevice).serialNumber}`,
          this.className
        );
        this.newDeviceDetached(device as any as UsbDevice);
        this.eventEmitter.emit('DETACH', device);
      }
    });
  }

  async deviceList(doEmitNewDevices: boolean = false): Promise<usb.Device[]> {
    const usbDevices: usb.Device[] = getDeviceList();
    const devices: usb.Device[] = usbDevices.filter(
      (dev: usb.Device) => dev.deviceDescriptor.idVendor === HuddlyHEX.VID
    );
    const foundDevices: usb.Device[] = [];
    for (let idx = 0; idx < devices.length; idx++) {
      const uuid: string = this.getDeviceUUID(devices[idx]);
      if (
        !this.isDeviceWithUUIDCached(uuid) &&
        (await this.fetchAndPopulateDeviceParams(devices[idx]))
      ) {
        this.newDeviceAttached(devices[idx] as any as UsbDevice);
        // We assume that the device "Detach" event will take care of clearing up the device cache list
        if (doEmitNewDevices) {
          this.eventEmitter.emit('ATTACH', devices[idx]);
        }
      }

      // After having generated the UUID and populated the device parameters, add it to the found device list
      foundDevices.push(devices[idx]);
    }
    return foundDevices;
  }

  async getDevice(serialNumber: string | undefined): Promise<usb.Device | undefined> {
    const devices: usb.Device[] = await this.deviceList();
    Logger.debug(`DeviceList found ${devices.length} enumerated Huddly devices`, this.className);

    if (serialNumber) {
      Logger.debug(
        `Filtering the devices for the following serial number: ${serialNumber}`,
        this.className
      );
      const targetDevice: usb.Device = devices.find((element: usb.Device) => {
        const dev: UsbDevice = element as any as UsbDevice;
        return (
          dev?.serialNumber.includes(serialNumber) || serialNumber?.includes(dev?.serialNumber)
        );
      });

      if (!targetDevice) {
        Logger.warn(
          `Unable to find device with serial ${serialNumber} among ${devices.length} huddly devices attached on the host machine!`,
          this.className
        );
      }

      return targetDevice;
    } else if (devices.length > 0) {
      if (devices.length > 1) {
        Logger.warn(
          `More than 1 Huddly device discovered! No target serial specified, picking the first device out of ${devices.length} devices.`,
          this.className
        );
      }
      return devices[0];
    }
    Logger.warn(
      `Could not find device with serial ${serialNumber} amongst ${devices.length} devices!`,
      this.className
    );
    return undefined;
  }
}
