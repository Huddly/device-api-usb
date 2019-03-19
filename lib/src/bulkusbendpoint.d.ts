import { BulkUsbDevice } from './bulkusbdevice';
export declare class BulkUsbEndpoint {
    private _cpp;
    device: BulkUsbDevice;
    private _cookie;
    isAttached: boolean;
    constructor(cpp: any, device: BulkUsbDevice, information: any);
    write(data: Buffer, timeoutMs: Number): Promise<Number>;
    read(maxSize: Number, timeoutMs: Number): Promise<Buffer>;
    close(): Promise<undefined>;
}
export default BulkUsbEndpoint;
