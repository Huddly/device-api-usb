const Manager = require('./lib/src/manager').default;
const EventEmitter = require('events').EventEmitter;
const manager = new Manager();
const emitter = new EventEmitter();

const a = async () => {

  emitter.on('ATTACH', (d) => {
    console.log("----------------- Devices ------------------------");
    console.log(d);
  });
  manager.registerForHotplugEvents(emitter);
}

const b = async () => {
  await manager.deviceList();
}

try{
  a();
  b();
} catch (a) {
  console.error(a);
}