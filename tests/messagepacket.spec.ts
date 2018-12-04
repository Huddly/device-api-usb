import chai from 'chai';
import sinonChai from 'sinon-chai';
import MessagePacket from './../src/messagepacket';

const expect = chai.expect;
chai.should();
chai.use(sinonChai);


describe('MessagePacket Factory', () => {
  describe('#createMessage', () => {
    it('should have a min packages size of HDR', () => {
      const messageBuffer = MessagePacket.createMessage('', Buffer.alloc(0));
      expect(messageBuffer.byteLength).to.be.equal(16);
    });

    it('should have a message', () => {
      const messageBuffer = MessagePacket.createMessage('hlink-open', Buffer.alloc(0));
      const minMessageSize = 128 / 8;
      expect(messageBuffer.toString('utf8').length).to.be.gt(minMessageSize);
    });

    it('should add a payload with payload size', () => {
      const messageBuffer = MessagePacket.createMessage('hlink', 'this is a payload');
      expect(messageBuffer.toString('utf8').indexOf('this is a payload')).to.not.be.equal(-1);
    });

    it('should have a payload size that describes the size of the payload', () => {
      const payload = 'this is a payload';
      const messageBuffer = MessagePacket.createMessage('hlink', payload);
      const payloadSize = messageBuffer.readUInt32LE(12);
      expect(payloadSize).to.be.equal(payload.length);
    });

    it('should have a message size that describes the size of the message', () => {
      const messageBuffer = MessagePacket.createMessage('hlink', Buffer.alloc(0));
      const messageSize = messageBuffer.readUInt16LE(10);
      expect(messageSize).to.be.equal(5);
    });
  });

  describe('#parseMessage string', () => {
    it('should get message', () => {
      const messageBufferBase64 = 'BQEACAAAAAAAAA0AAAAAAGR1bW15IG1lc3NhZ2U='; // Represents the 'dummy message' as base64 string
      const buffer = Buffer.from(messageBufferBase64, 'base64');
      const messagObj = MessagePacket.parseMessage(buffer);
      expect(messagObj['message']).to.equal('dummy message');
    });

    it('should get a not empty payload buffer', () => {
      const messageBufferBase64 = 'AAAAAAAAAAAAAAYACwAAAGhlbGxvAGhlbGxvLWhlbGxv';
      const buffer = Buffer.from(messageBufferBase64, 'base64');
      const messagObj = MessagePacket.parseMessage(buffer);
      expect(messagObj['payload']).to.be.instanceof(Buffer);
      expect(messagObj['payload'].length).to.be.gt(0);
    });

    it('should get the same payload message from the payload buffer', () => {
      const messageBufferBase64 = 'AAAAAAAAAAAAAAYACwAAAGhlbGxvAGhlbGxvLWhlbGxv';
      const buffer = Buffer.from(messageBufferBase64, 'base64');
      const messagObj = MessagePacket.parseMessage(buffer);
      const payload = messagObj['payload'].toString('utf8');
      expect(payload).to.equal('hello-hello');
    });

    it('should throw an error if it can not read header', () => {
      const messageBufferBase64 = 'INVALIDDATA';
      const buffer = Buffer.from(messageBufferBase64, 'base64');
      expect(() => {
        MessagePacket.parseMessage(buffer);
      }).to.throw(Error);
    });
  });
});
