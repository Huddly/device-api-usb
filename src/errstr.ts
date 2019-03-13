export function errstr(n: any): Error {
  switch (n) {
    case -4: return new Error('LIBUSB_ERROR_NO_DEVICE');
    case -7: return new Error('LIBUSB_ERROR_TIMEOUT');
    default: return new Error(`Unknown error ${n}`);
  }
}

export default errstr;
