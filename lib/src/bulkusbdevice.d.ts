import BulkUsbEndpoint from './bulkusbendpoint';
export declare class BulkUsbDevice {
    private _cpp;
    vid: number;
    pid: number;
    serialNumber: string;
    location: ReadonlyArray<number>;
    private _cookie;
    /** @internal */
    _onDetaches: Array<(dev: BulkUsbDevice) => void>;
    /** @internal */
    _openEndpoint: undefined | BulkUsbEndpoint;
    constructor(cpp: any, information: any);
    onDetach(cb: (dev: BulkUsbDevice) => void): void;
    open(): Promise<BulkUsbEndpoint>;
    equals(other: BulkUsbDevice): boolean;
}
declare class BulkUsbSingleton {
    private static _instance;
    private _cpp;
    private _activeDevices;
    private _previousDevices;
    private _onAttaches;
    private _isPolling;
    private _firstListResolve;
    private _firstListDone;
    private constructor();
    static readonly Instance: BulkUsbSingleton;
    private _listDevices;
    private _pollLoop;
    listDevices(): Promise<ReadonlyArray<BulkUsbDevice>>;
    onAttach(cb: (dev: BulkUsbDevice) => Promise<void>): Promise<void>;
}
declare const _default: BulkUsbSingleton;
export default _default;
