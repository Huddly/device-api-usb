export function errstr(n: any): Error {
  switch (n) {
    case -7: return new Error('LIBUSB_ERROR_TIMEOUT');
    default: return new Error(`Unknown error ${n}`);
  }
}

export default errstr;

