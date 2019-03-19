import IHuddlyDeviceAPI from '@huddly/sdk/lib/src/interfaces/iHuddlyDeviceAPI';
import NodeUsbTransport from './transport';
import { EventEmitter } from 'events';
import IUVCControlAPI from '@huddly/sdk/lib/src/interfaces/iUVCControlApi';
import ITransport from '@huddly/sdk/lib/src/interfaces/iTransport';
import IDeviceDiscovery from '@huddly/sdk/lib/src/interfaces/iDeviceDiscovery';
import DeviceApiOpts from '@huddly/sdk/lib/src/interfaces/IDeviceApiOpts';
import DeviceDiscoveryManager from './manager';
export default class HuddlyDeviceAPIUSB implements IHuddlyDeviceAPI {
    logger: any;
    eventEmitter: EventEmitter;
    deviceDiscoveryManager: DeviceDiscoveryManager;
    constructor(opts?: DeviceApiOpts);
    initialize(): Promise<void>;
    registerForHotplugEvents(eventEmitter: EventEmitter): void;
    getDeviceDiscoveryAPI(): Promise<IDeviceDiscovery>;
    getValidatedTransport(device: any): Promise<ITransport>;
    getTransport(device: any): Promise<NodeUsbTransport>;
    isUVCControlsSupported(device: any): Promise<boolean>;
    getUVCControlAPIForDevice(device: any): Promise<IUVCControlAPI>;
    isHIDSupported(device: any): Promise<boolean>;
    getHIDAPIForDevice(device: any): Promise<any>;
}
