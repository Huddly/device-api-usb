import usb from 'usb';
import EventEmitter from 'events';
import IDeviceDiscovery from '@huddly/sdk/lib/src/interfaces/iDeviceDiscovery';

export default class DeviceDiscoveryManager implements IDeviceDiscovery {
  readonly HUDDLY_VID: number = 0x2bd9;
  private attachedDevices: Array<any> = [];
  eventEmitter: EventEmitter;

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
    this.eventEmitter = eventEmitter;
    try {
      usb.on('attach', async (device) => {
        await this.fetchAndPopulateDevieParams(device);
        if (device.vendorId === 0x2bd9) {
          this.updateCache([device], []);
          eventEmitter.emit('ATTACH', device);
        }
      });

      usb.on('detach', (device) => {
        if (device.deviceDescriptor.idVendor === 0x2bd9) { // Emit detach only for huddly devices
          this.setDeviceUid(device);
          const cachedDevice = this.getCachedDevice(device);
          this.updateCache([], [device]);

          if (cachedDevice) {
            eventEmitter.emit('DETACH', cachedDevice.serialNumber);
          } else {
            eventEmitter.emit('DETACH', device.id);
          }
        }
      });
      console.log('-------- Using hotplug events for this machine');
    } catch (e) {
      console.log('-------- Hot plug events is not supported. Using the workaround@!');
      console.log(e);
      setInterval(() => this.discoverCameras(), 1000);
    }
  }

  private getCachedDevice(device: any): any {
    return this.attachedDevices.find((dev) => dev.id === device.id);
  }

  async discoverCameras(): Promise<void> {
    const { newDevices, removedDevices } = await this.deviceList();
    newDevices.forEach(newDevice => this.eventEmitter.emit('ATTACH', newDevice));
    removedDevices.forEach(removedDevice => this.eventEmitter.emit('DETACH', removedDevice.serialNumber));
  }

  async deviceList(): Promise<any> {
    const usbDevices = usb.getDeviceList()
      .filter(d => d.deviceDescriptor && d.deviceDescriptor.idVendor === 0x2bd9);

    const newDevices = [];
    for (let idx = 0; idx < usbDevices.length; idx++) {
      const usbDevice = usbDevices[idx];
      this.setDeviceUid(usbDevice);
      if (!this.isDeviceCached(usbDevice)) {
        await this.fetchAndPopulateDevieParams(usbDevice);
        newDevices.push(usbDevice);
      }
    }

    const removedDevices = this.attachedDevices.filter(({ id, serialNumber }) => {
      return usbDevices.every((device) => device.serialNumber !== serialNumber);
    });

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

  private async fetchAndPopulateDevieParams(device): Promise<any> {
    device.open();
    return new Promise((resolve, reject) => {
      device.getStringDescriptor(device.deviceDescriptor.iSerialNumber, (err, serialNo) => {
        if (err) reject(err);
        device.getStringDescriptor(device.deviceDescriptor.iProduct, (err, productName) => {
          if (err) reject(err);
          else {
            this.setDeviceUid(device);
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

  private setDeviceUid(device: any) {
    const uid = this.generateUsbUniqueId({
      usbBusNumber: device.busNumber,
      usbDeviceAddress: device.deviceAddress,
      usbPortNumbers: device.portNumbers
    });
    device.id = uid;
  }

  private isDeviceCached(device: any): boolean {
    return this.attachedDevices.some((dev) => dev.id === device.id || dev.serialNumber === device.serialNumber);
  }

  private updateCache(newDevices: Array<any>, removedDevice: Array<any>) {
    newDevices.forEach(newDevice => this.attachedDevices.push({
      id: newDevice.id,
      serialNumber: newDevice.serialNumber
    }));
    removedDevice.forEach(removedDevice => {
      this.attachedDevices = this.attachedDevices.filter(
        device => device.id !== removedDevice.id
      );
    });
  }
}
