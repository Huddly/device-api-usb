/// <reference types="node" />
import ITransport from '@huddly/sdk/lib/src/interfaces/iTransport';
import DeviceEndpoint from './bulkusbendpoint';
import { EventEmitter } from 'events';
interface SendMessage {
    resolve(message?: any): void;
    reject(message: any): void;
    msgBuffer: Buffer;
}
export default class NodeUsbTransport extends EventEmitter implements ITransport {
    readonly MAX_PACKET_SIZE: number;
    readonly VSC_INTERFACE_CLASS = 255;
    readonly DEFAULT_LOOP_READ_SPEED = 60000;
    readonly READ_STATES: Readonly<{
        NEW_READ: string;
        PENDING_CHUNK: string;
    }>;
    _device: any;
    /**
     * The evetLoopSpeed shall not be used in this class since node-usb read
     * endpoint does not send back empty buffers unless there is something
     * to send back. In that case the read will be resolved and the loop will
     * proceed imediately to read the next packet (and potentially wait until
     * the next packet arrives). This function is used to maintain compatibility
     * with the other device-api transport implementations.
     *
     * @type {number}
     * @memberof NodeUsbTransport
     */
    eventLoopSpeed: number;
    logger: any;
    running: any;
    vscInterface: any;
    endpoint: DeviceEndpoint;
    timeoutMs: Number;
    listenerTimeoutId: Number;
    sendQueue: Array<SendMessage>;
    constructor(device: any, logger: any);
    /**
     * Getter method for device class attribute.
     *
     * @type {*}
     * @memberof NodeUsbTransport
     */
    /**
    * Set method for device class attribute.
    *
    * @memberof NodeUsbTransport
    */
    device: any;
    setEventLoopReadSpeed(timeout?: number): void;
    sleep(seconds?: number): Promise<any>;
    init(): Promise<any>;
    initEventLoop(): void;
    startbulkReadWrite(): Promise<void>;
    sendMessage(): Promise<void>;
    readMessage(): Promise<void>;
    startListen(): Promise<void>;
    on(eventName: string, listener: any): this;
    removeListener(eventName: string, listener: any): this;
    removeAllListeners(eventName?: string): this;
    receiveMessage(msg: string, timeout?: number): Promise<any>;
    read(receiveMsg?: string, timeout?: number): Promise<any>;
    write(cmd: string, payload?: any): Promise<any>;
    subscribe(command: string): Promise<any>;
    unsubscribe(command: string): Promise<any>;
    clear(): Promise<any>;
    close(): Promise<void>;
    stopEventLoop(): Promise<any>;
    claimInterface(): Promise<any>;
    closeDevice(): Promise<any>;
    receive(): Promise<Buffer>;
    transfer(messageBuffer: Buffer): Promise<void>;
    readChunk(packetSize?: number): Promise<any>;
    sendChunk(chunk: Buffer): Promise<any>;
    performHlinkHandshake(): Promise<void>;
}
export {};
