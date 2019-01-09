
/**
 * @ignore
 *
 * @export
 * @class MessagePacket
 */
export default class MessagePacket {

  static HEADER_SIZES = Object.freeze({
    HDR_MESSAGE_SIZE_OFFSET: 10,
    HDR_PAYLOAD_SIZE_OFFSET: 12,
    HDR_SIZE: 16,
  });

  static createMessage(message: string, payload: any, fullPayloadSize?: number): Buffer {
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

  static parseMessage(messageBuffer: Buffer): any {
    try {
      const messageSize = messageBuffer.readUInt16LE(MessagePacket.HEADER_SIZES.HDR_MESSAGE_SIZE_OFFSET);
      const payloadSize = messageBuffer.readUInt32LE(MessagePacket.HEADER_SIZES.HDR_PAYLOAD_SIZE_OFFSET);
      const payloadOffset = messageSize + MessagePacket.HEADER_SIZES.HDR_SIZE;
      const message = messageBuffer.toString('utf8', MessagePacket.HEADER_SIZES.HDR_SIZE, payloadOffset);
      const payload = messageBuffer.slice(payloadOffset);

      return {
        message,
        payload,
        messageSize,
        payloadSize,
      };
    } catch (e) {
      throw new Error(`Hlink message could not be parsed! ${e}`);
    }
  }
}
