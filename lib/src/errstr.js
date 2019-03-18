"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function errstr(n) {
    switch (n) {
        case -1: return new Error('LIBUSB_ERROR_IO');
        case -4: return new Error('LIBUSB_ERROR_NO_DEVICE');
        case -7: return new Error('LIBUSB_ERROR_TIMEOUT');
        default: return new Error(`Unknown error ${n}`);
    }
}
exports.errstr = errstr;
exports.default = errstr;
//# sourceMappingURL=errstr.js.map