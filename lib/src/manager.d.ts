/// <reference types="node" />
import { BulkUsbDevice } from './bulkusbdevice';
import EventEmitter from 'events';
import IDeviceDiscovery from '@huddly/sdk/lib/src/interfaces/iDeviceDiscovery';
export default class DeviceDiscoveryManager implements IDeviceDiscovery {
    readonly HUDDLY_VID: number;
    private attachedDevices;
    eventEmitter: EventEmitter;
    logger: any;
    pollInterval: any;
    constructor(logger: any);
    registerForHotplugEvents(eventEmitter: EventEmitter): void;
    private getDeviceObject;
    destroy(): void;
    discoverCameras(): void;
    private deviceAttached;
    private deviceDetached;
    deviceList(): Promise<{
        devices: BulkUsbDevice[];
    }>;
    getDevice(serialNumber: string | undefined): Promise<BulkUsbDevice | undefined>;
}
