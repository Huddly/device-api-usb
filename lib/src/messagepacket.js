"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Message {
    constructor(message, messageSize, payload, payloadSize) {
        this.message = message;
        this.messageSize = messageSize;
        this.payload = payload;
        this.payloadSize = payloadSize;
    }
    totalSize() {
        return MessagePacket.HEADER_SIZES.HDR_SIZE + this.messageSize + this.payloadSize;
    }
    isComplete() {
        return this.payload.byteLength >= this.payloadSize;
    }
}
/**
 * @ignore
 *
 * @export
 * @class MessagePacket
 */
class MessagePacket {
    static createMessage(message, payload, fullPayloadSize) {
        const messageBuffer = Buffer.from(message);
        const hdrBuffer = Buffer.alloc(MessagePacket.HEADER_SIZES.HDR_SIZE);
        let payloadBuffer = Buffer.from(payload);
        if (payload instanceof Buffer) {
            payloadBuffer = payload;
        }
        const payloadSize = fullPayloadSize || payloadBuffer.byteLength;
        hdrBuffer.writeUInt16LE(messageBuffer.byteLength, MessagePacket.HEADER_SIZES.HDR_MESSAGE_SIZE_OFFSET);
        hdrBuffer.writeUInt32LE(payloadSize, MessagePacket.HEADER_SIZES.HDR_PAYLOAD_SIZE_OFFSET);
        const packageBuffer = Buffer.concat([hdrBuffer, messageBuffer, payloadBuffer]);
        return packageBuffer;
    }
    static parseMessage(messageBuffer) {
        const HDR_SIZE = MessagePacket.HEADER_SIZES.HDR_SIZE;
        if (messageBuffer.byteLength < HDR_SIZE) {
            throw new Error(`Header must be at least ${HDR_SIZE} bytes long. Not ${messageBuffer.length}.`);
        }
        const reserved = messageBuffer.slice(0, MessagePacket.HEADER_SIZES.HDR_MESSAGE_SIZE_OFFSET);
        Uint8Array.from(reserved).forEach((num, idx) => {
            if (num !== 0) {
                throw new Error(`Expected zero byte in reserved area at offset ${idx}, got ${num}`);
            }
        });
        let ret;
        try {
            const messageSize = messageBuffer.readUInt16LE(MessagePacket.HEADER_SIZES.HDR_MESSAGE_SIZE_OFFSET);
            const payloadSize = messageBuffer.readUInt32LE(MessagePacket.HEADER_SIZES.HDR_PAYLOAD_SIZE_OFFSET);
            const payloadOffset = messageSize + HDR_SIZE;
            const message = messageBuffer.toString('utf8', HDR_SIZE, payloadOffset);
            const payload = messageBuffer.slice(payloadOffset);
            ret = new Message(message, messageSize, payload, payloadSize);
        }
        catch (e) {
            throw new Error(`Hlink message could not be parsed! ${e}`);
        }
        return Object.freeze(ret);
    }
}
MessagePacket.HEADER_SIZES = Object.freeze({
    HDR_MESSAGE_SIZE_OFFSET: 10,
    HDR_PAYLOAD_SIZE_OFFSET: 12,
    HDR_SIZE: 16,
});
exports.default = MessagePacket;
//# sourceMappingURL=messagepacket.js.map