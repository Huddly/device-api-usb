import BulkUsb, { BulkUsbDevice } from './bulkusbdevice';


BulkUsb.onAttach(async (d) => {
  console.log('device attached', d);
});
