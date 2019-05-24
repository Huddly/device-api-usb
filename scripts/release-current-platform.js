const os = require('os');
const spawnSync = require('npm-run').spawnSync;
const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const targz = require('tar.gz');
const sendToAzure = require('./send-to-azure');
const copyfiles = require('copyfiles');

const pkg = require('./package.json');

const platform = os.platform();

console.log('Current platform:', platform);

rimraf.sync('dist');
fs.mkdirSync('dist');

let archs;

switch (platform) {
  case 'linux':
  case 'darwin':
    archs = ['x64'];
    break;
  case 'win32':
    archs = ['x64', 'ia32'];
    break;
}

const filesToSend = [];

const version = pkg.version;
const sha = process.env.TRAVIS_TAG ? '' : process.env.TRAVIS_COMMIT;
const builtVersions = pkg.binary.builtVersions;

const destName = `device-api-usb-prod-${version + sha}`;
const destDir = path.join('.', 'dist', destName);
const tarballFilename = path.join('.', 'dist', `${destName}.tar.gz`);

const targets = [];
for (const runtime in builtVersions) {
  targets.push(`--target=${runtime}@${version}`);
}

function copyFile() {
  return new Promise() {
    
  }
}

function prepareBinaries() {
  const promises = [];
  for (var i = 0 ; i < archs.length ; i++) {
    const arch = archs[i];

    const cmdName = 'prebuildify';
    const curCmds = targets.concat(
      ['.',
      ['--arch', arch].join('='),
      ['--platform', platform].join('=')
      ]);
    console.log('spawning:', cmdName, curCmds);
    spawnSync(cmdName, curCmds, { shell: true, stdio: ['inherit', 'inherit', 'inherit'] });
    const abiPromises = [];

    for (const runtime in builtVersions) {
      const abi = [runtime, abiVersion].join('-');
      const sourceFile = path.join('.', 'prebuilds', [platform, arch].join('-'), [abi, 'node'].join('.'));
      const destFile = path.join('.', 'dist', [[abi, version, platform, arch, sha].join('-'), 'node'].join('.'))
      filesToSend.push(destFile);
      abiPromises.push(copyFile(sourceFile, destFile));
    }
    promises.push(Promise.all(abiPromises));

  }
  return Promise.all(promises);
}

function prepareDistPackage() {
  fs.mkdirSync(destDir);

  delete pkg.devDependencies;
  delete pkg.optionalDependencies;
  delete pkg.bundledDependencies;
  pkg.scripts = {
    install: pkg.scripts.install_released_version,
  };

  return Promise.all(
    [
      copyFile('./lib/*', destDir)),
      new Promise((resolve, reject) => {
        fs.writeFile(path.join(destDir, 'package.json'), JSON.stringify(pkg, null, 2), (err) => {
          if (err) {
            reject(err);
          } else {
            console.log('package.json was saved to ' + path.join(destDir, 'package.json'));
            resolve();
          }
        })
      })
    ]
  ).then(() => {
    console.log('Prepared package, now creating a tarball');

  });
}

function createTarball() {
  return new Promise((resolve, reject) => {
    var read = targz().createReadStream(destDir);
    var write = fs.createWriteStream(tarballFilename);
    read.pipe(write);
    write.on('finish', () => {
      console.log('Tarball saved');
      filesToSend.push(tarballFilename);
      resolve();
      /*
      sendToAzure(tarballFilename)
        .then(r => console.log('File saved:', r))
        .catch(r => console.log('Error:', r));
      */
    });
    read.on('error', reject);
    write.on('error', reject)
  });
}

function sendFiles() {
  const promises = [];

  filesToSend.forEach((file) => {
    console.log(`Uploading file ${file}`);
    promises.push(sendToAzure(file));
  });

  return Promise.all(promises);
}

prepareBinaries()
.then(prepareDistPackage)
.then(createTarball)
.then(sendFiles)
.catch((e) => {
  console.log('Caught error', e);
});
