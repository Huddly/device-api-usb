import BulkUsb, { BulkUsbDevice } from './bulkusbdevice';


let count = 0;
BulkUsb.onAttach(async (d) => {
  count ++;
  if (d.vid != 11225) {
    return;
  }
  console.log('JS:::::::::::::device attached', count);
  // await new Promise(res => setTimeout(res, 2000));
  await d.open();
});
