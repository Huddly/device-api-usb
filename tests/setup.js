process.on('SIGABRT', function () {
  process.stdout.write('GOT SIGABORT\n');
  process.exit(0);
});
