const os = require('os');
const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const targz = require('tar');
const sendToAzure = require('./send-to-azure');
const { createManifestFile } = require('./generate-manifest');
const copyfiles = require('copyfiles');

const pkg = require('../package.json');

const platform = os.platform();

console.log('Current platform:', platform);

// Make a folder for hosting the compiled source-code of the repo
rimraf.sync('dist');
fs.mkdirSync('dist');

// Make a folder for hosting the renamed prebuild binaries
rimraf.sync('tmp');
fs.mkdirSync('tmp');

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
const sha = (!process.env.TRAVIS_TAG || process.env.TRAVIS_TAG === 'false') ? process.env.TRAVIS_COMMIT : '';
const builtVersions = pkg.binary.builtVersions;

const destName = `device-api-usb-prod-${version + sha}`;
const destDir = path.join('.', 'dist', destName);
const destScripts = path.join(destDir, 'scripts');
const tarballFilename = path.join('.', 'dist', `${destName}.tar.gz`);

const targets = [];
for (const runtime in builtVersions) {
  targets.push(`--target=${runtime}@${version}`);
}

/**
 * Convenience function for copying the contents of a
 * directory into another directory
 *
 * @param {*} src Path of the source directory
 * @param {*} dest Path to the destination directory
 * @returns Promise
 */
function copyDirectory(src, dest) {
  console.log('Copy directory from:', src, 'to:', dest);
  return new Promise((resolve, reject) => {
    copyfiles([src, dest], { up: 1 }, (err) => {
      if (err) {
        reject();
        return;
      }
      resolve();
    });
  });
}

/**
 * Convenience function that copies a file from one directory
 * to another.
 *
 * @param {*} sourceFile Path of the source file to be copied
 * @param {*} destFile Destination of the copied file
 * @returns Promise
 */
function copyFile(sourceFile, destFile) {
  return new Promise((resolve, reject) => {
    console.log(`Copying: ${sourceFile} -> ${destFile}`);
    const read = fs.createReadStream(sourceFile);
    const write = fs.createWriteStream(destFile);
    read.pipe(write);

    write.on('finish', () => {
      console.log(`Copied: ${sourceFile} -> ${destFile}`);
      resolve();
    });

    write.on('error', (e) => {
      console.log(`Error copying file: ${sourceFile} -> ${destFile}`, e);
      reject(e);
    });
  });
}

/**
 * Convenience function that copies the generated prebuild
 * binaries for the current platform into a temporary folder
 * with the correct name (name that contains platform, arch, abi
 * version, and/or gitsha).
 *
 * @returns Promise
 */
function prepareBinaries() {
  for (var i = 0 ; i < archs.length ; i++) {
    const arch = archs[i];

    builtVersions.map( runtime => {
      const abi = [runtime].join('-');
      const nodeFileNames = [abi, version, platform, arch];
      if (sha.length > 0) {
        nodeFileNames.push(sha);
      }
      const sourceFile = path.join('.', 'prebuilds', [platform, arch].join('-'), [abi, 'node'].join('.'));
      const tmpDestFile = path.join('.', 'tmp', [nodeFileNames.join('-'), 'node'].join('.'))
      filesToSend.push(tmpDestFile);
      return copyFile(sourceFile, tmpDestFile);
    });
  }
  return Promise.resolve();
}

/**
 * Prepares the dist folder with all necessary files such as
 * the compiled source code of device-api-usb, package.json,
 * manifest.json and the scripts directory used during install.
 * This is useful when referencing device-api-usb dependency
 * using the .tar.gz file.
 *
 * @returns Promise
 */
function prepareDistPackage() {
  fs.mkdirSync(destDir);
  fs.mkdirSync(destScripts);

  delete pkg.devDependencies;
  delete pkg.optionalDependencies;
  delete pkg.bundledDependencies;
  console.log('Copy files', destDir);
  console.log('Copy scripts', destScripts);
  return Promise.all(
    [
      copyDirectory('./lib/**/*', path.join(destDir, 'lib')),
      copyDirectory('./scripts/*.js', destScripts),
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

/**
 * Convenience function that creates a tar.gz file with the contents
 * of the `dist` folder which was popullated from `prepareDistPackage`
 * function.
 *
 * @returns Promise
 */
function createTarball() {
  return new Promise((resolve, reject) => {
    var read = targz.c({ gzip: true, cwd: path.join(process.cwd(), 'dist') }, [destName]);
    console.log('Dest dir', destDir);
    var write = fs.createWriteStream(tarballFilename);
    read.pipe(write);
    write.on('finish', () => {
      console.log('Tarball saved', tarballFilename);
      filesToSend.push(tarballFilename);
      resolve();
    });
    read.on('error', reject);
    write.on('error', reject)
  });
}

/**
 * Convenience function for uploading files to azure
 *
 * @returns Promise
 */
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
.then(() => createManifestFile(destDir, false, sha))
.then(createTarball)
.then(sendFiles)
.catch((e) => {
  console.log('Caught error', e);
});
