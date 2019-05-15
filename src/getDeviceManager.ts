import DM from './manager';
import EventEmitter from 'events';


const dm = new DM(undefined);
const em = new EventEmitter();

let count = 0;
em.on('ATTACH', async (d) => {
  console.log('----------- attach --------------', d);
  const endpoint = await d.open();
  console.log('------------- opned -----------------', count++);
  try {
    await endpoint.read(4096, 1000);
    console.log('------------- read -----------------');
  } catch (e) {
    console.log('------------ error read -------------', e);
  }
  try {
    this.endpoint.write(Buffer.alloc(200), 10000);
    console.log('------------- write -----------------');
  } catch (e) {
    console.log('----------- error write --------------', e);
  }
});

dm.registerForHotplugEvents(em);
