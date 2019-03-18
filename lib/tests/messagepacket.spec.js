"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = __importDefault(require("chai"));
const sinon_chai_1 = __importDefault(require("sinon-chai"));
const messagepacket_1 = __importDefault(require("./../src/messagepacket"));
const expect = chai_1.default.expect;
chai_1.default.should();
chai_1.default.use(sinon_chai_1.default);
describe('MessagePacket Factory', () => {
    describe('#createMessage', () => {
        it('should have a min packages size of HDR', () => {
            const messageBuffer = messagepacket_1.default.createMessage('', Buffer.alloc(0));
            expect(messageBuffer.byteLength).to.be.equal(16);
        });
        it('should have a message', () => {
            const messageBuffer = messagepacket_1.default.createMessage('hlink-open', Buffer.alloc(0));
            const minMessageSize = 128 / 8;
            expect(messageBuffer.toString('utf8').length).to.be.gt(minMessageSize);
        });
        it('should add a payload with payload size', () => {
            const messageBuffer = messagepacket_1.default.createMessage('hlink', 'this is a payload');
            expect(messageBuffer.toString('utf8').indexOf('this is a payload')).to.not.be.equal(-1);
        });
        it('should have a payload size that describes the size of the payload', () => {
            const payload = 'this is a payload';
            const messageBuffer = messagepacket_1.default.createMessage('hlink', payload);
            const payloadSize = messageBuffer.readUInt32LE(12);
            expect(payloadSize).to.be.equal(payload.length);
        });
        it('should have a message size that describes the size of the message', () => {
            const messageBuffer = messagepacket_1.default.createMessage('hlink', Buffer.alloc(0));
            const messageSize = messageBuffer.readUInt16LE(10);
            expect(messageSize).to.be.equal(5);
        });
    });
    describe('#parseMessage string', () => {
        it('should get message', () => {
            const messageBufferBase64 = 'AAAAAAAAAAAAAA0AAAAAAGR1bW15LW1lc3NhZ2U='; // Represents the 'dummy message' as base64 string
            const buffer = Buffer.from(messageBufferBase64, 'base64');
            const messagObj = messagepacket_1.default.parseMessage(buffer);
            expect(messagObj['message']).to.equal('dummy-message');
        });
        it('should get a not empty payload buffer', () => {
            const messageBufferBase64 = 'AAAAAAAAAAAAAAYACwAAAGhlbGxvAGhlbGxvLWhlbGxv';
            const buffer = Buffer.from(messageBufferBase64, 'base64');
            const messagObj = messagepacket_1.default.parseMessage(buffer);
            expect(messagObj['payload']).to.be.instanceof(Buffer);
            expect(messagObj['payload'].length).to.be.gt(0);
        });
        it('should get the same payload message from the payload buffer', () => {
            const messageBufferBase64 = 'AAAAAAAAAAAAAAYACwAAAGhlbGxvAGhlbGxvLWhlbGxv';
            const buffer = Buffer.from(messageBufferBase64, 'base64');
            const messagObj = messagepacket_1.default.parseMessage(buffer);
            const payload = messagObj['payload'].toString('utf8');
            expect(payload).to.equal('hello-hello');
        });
        it('should throw an error if it can not read header', () => {
            const messageBufferBase64 = 'INVALIDDATA';
            const buffer = Buffer.from(messageBufferBase64, 'base64');
            expect(() => {
                messagepacket_1.default.parseMessage(buffer);
            }).to.throw(Error);
        });
    });
});
//# sourceMappingURL=messagepacket.spec.js.map