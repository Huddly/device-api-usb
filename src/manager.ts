import usb from 'usb';
import EventEmitter from 'events';
import IDeviceDiscovery from '@huddly/sdk/lib/src/interfaces/iDeviceDiscovery';

export default class DeviceDiscoveryManager implements IDeviceDiscovery {
  readonly HUDDLY_VID: number = 0x2bd9;
  private attachedDevices: Array<any> = [];

  generateUsbUniqueId(props: { usbBusNumber: number, usbDeviceAddress: number, usbPortNumbers: Array<Number> }): string {
    const stringCombo = String(props.usbBusNumber).concat(String(props.usbDeviceAddress).concat(props.usbPortNumbers.toString()));
    let hash = 0;
    for (let i = 0; i < stringCombo.length; i++) {
      const char = stringCombo.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  registerForHotplugEvents(eventEmitter: EventEmitter): void {
    usb.on('attach', async (device) => {
      await this.fetchAndPopulateDevieParams(device);
      if (device.vendorId === 0x2bd9) {
        this.cacheUsbDevice(device);
        eventEmitter.emit('ATTACH', device);
      }
    });

    usb.on('detach', (device) => {
      if (device.deviceDescriptor.idVendor === 0x2bd9) { // Emit detach only for huddly devices
        const detachDeviceHash = this.generateUsbUniqueId({
          usbBusNumber: device.busNumber,
          usbDeviceAddress: device.deviceAddress,
          usbPortNumbers: device.portNumbers
        });
        device.id = detachDeviceHash;
        const cachedDevice = this.attachedDevices.find((dev) => dev.id === detachDeviceHash);
        this.attachedDevices = this.attachedDevices.filter((dev) => dev.id !== detachDeviceHash);

        if (cachedDevice) {
          eventEmitter.emit('DETACH', cachedDevice.serialNumber);
        } else {
          eventEmitter.emit('DETACH', detachDeviceHash);
        }
      }
    });
  }

  async deviceList(): Promise<Array<any>> {
    const usbDevices = usb.getDeviceList()
      .filter(d => d.deviceDescriptor && d.deviceDescriptor.idVendor === 0x2bd9);
    for (let idx = 0; idx < usbDevices.length; idx++) {
      await this.fetchAndPopulateDevieParams(usbDevices[idx]);
      this.cacheUsbDevice(usbDevices[idx]);
    }
    return usbDevices;
  }

  async getDevice(serialNumber: any): Promise<any> {
    const devices = await this.deviceList();

    let myDevice = undefined;
    if (serialNumber) {
      myDevice = devices.find(d => d.serialNumber.indexOf(serialNumber) >= 0);
    } else if (devices.length > 0) {
      myDevice = devices[0];
    }

    return myDevice;
  }

  private async fetchAndPopulateDevieParams(device): Promise<any> {
    device.open();
    return new Promise((resolve, reject) => {
      device.getStringDescriptor(device.deviceDescriptor.iSerialNumber, (err, serialNo) => {
        if (err) reject(err);
        device.getStringDescriptor(device.deviceDescriptor.iProduct, (err, productName) => {
          if (err) reject(err);
          else {
            const uid = this.generateUsbUniqueId({
              usbBusNumber: device.busNumber,
              usbDeviceAddress: device.deviceAddress,
              usbPortNumbers: device.portNumbers
            });
            device.id = uid;
            device.serialNumber = serialNo;
            device.productName = productName;
            if (device && device.deviceDescriptor) {
              device.productId = device.deviceDescriptor.idProduct;
              device.vendorId = device.deviceDescriptor.idVendor;
            }
            device.close();
            resolve(device);
          }
        });
      });
    });
  }

  private cacheUsbDevice(device: any): void {
    const exists = this.attachedDevices.find((dev) => dev.id === device.id || dev.serialNumber === device.serialNumber);
    if (!exists) {
      this.attachedDevices.push({
        id: device.id,
        serialNumber: device.serialNumber
      });
    }
  }
}
