export function errstr(n: any): Error {
  switch (n) {
    case  0: return new Error('LIBUSB_SUCCESS');
    case -1: return new Error('LIBUSB_ERROR_IO');
    case -2: return new Error('LIBUSB_ERROR_INVALID_PARAM');
    case -3: return new Error('LIBUSB_ERROR_ACCESS');
    case -4: return new Error('LIBUSB_ERROR_NO_DEVICE');
    case -5: return new Error('LIBUSB_ERROR_NOT_FOUND');
    case -6: return new Error('LIBUSB_ERROR_BUSY');
    case -7: return new Error('LIBUSB_ERROR_TIMEOUT');
    case -8: return new Error('LIBUSB_ERROR_OVERFLOW');
    case -9: return new Error('LIBUSB_ERROR_PIPE');
    case -10: return new Error('LIBUSB_ERROR_INTERRUPTED');
    case -11: return new Error('LIBUSB_ERROR_NO_MEM');
    case -12: return new Error('LIBUSB_ERROR_NOT_SUPPORTED');
    case -99: return new Error('LIBUSB_ERROR_OTHER');
    default: return new Error(`Unknown error ${n}`);
  }
}

export default errstr;
