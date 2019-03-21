/// <reference types="node" />
declare class Message {
    message: string;
    messageSize: number;
    payload: Buffer;
    payloadSize: number;
    constructor(message: string, messageSize: number, payload: Buffer, payloadSize: number);
    totalSize(): number;
    isComplete(): boolean;
}
/**
 * @ignore
 *
 * @export
 * @class MessagePacket
 */
export default class MessagePacket {
    static HEADER_SIZES: Readonly<{
        HDR_MESSAGE_SIZE_OFFSET: number;
        HDR_PAYLOAD_SIZE_OFFSET: number;
        HDR_SIZE: number;
    }>;
    static createMessage(message: string, payload: any, fullPayloadSize?: number): Buffer;
    static parseMessage(messageBuffer: Buffer): Readonly<Message>;
}
export {};
