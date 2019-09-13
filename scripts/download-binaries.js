const fs = require('fs');
const https = require('https');
const pkgJson = require('./../package.json');
const path = require('path');
var exec = require('child_process').exec;

const installElectron =
  typeof process.env.INSTALL_ELECTRON !== 'undefined'
    ? !!parseInt(process.env.INSTALL_ELECTRON, 10)
    : true;
const installNode =
  typeof process.env.INSTALL_NODE !== 'undefined'
    ? !!parseInt(process.env.INSTALL_NODE, 10)
    : true;

/**
 * Attempts to read a manifest json file on the root directory
 * which contains meta information about prebuild binaries. If
 * file does not exist, the script will try to download prebuilds
 * that are tagged with the current gitsha of the project.
 *
 * @returns A json object containing gitsha and tag which
 * are used to determine where the prebuilds binaries are
 * downloaded.
 */
function readManifestData() {
  return new Promise((resolve) =>
    fs.exists('manifest.json', (exists) => {
      if (exists) {
        // get it from manifest file
        const manifestJson = require('./../manifest.json');
        resolve(manifestJson);
      } else {
        // ask git
        exec("git log --pretty=format:'%H' -n 1 .", (error, stdout, stderr) => {
          const gitsha = stdout;
          resolve({
            tag: undefined,
            gitsha,
          })
        });
      }
    })
  );
}

/**
 * Delete a folder and all its contents recursively
 *
 * @param {*} path The path to the folder to be deleted
 */
function deleteFolderRecursive(path) {
  if( fs.existsSync(path) ) {
    fs.readdirSync(path).forEach(function(file,index){
      var curPath = [path, file].join('/');
      if(fs.lstatSync(curPath).isDirectory()) { // recurse
        deleteFolderRecursive(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
};

/**
 * Convenience function for downloading prebuilds binaries
 *
 * @param {*} platform Operating system platform (linux, darwin or win32)
 * @param {*} arch Architecture of prebuild binaries (ex: x64 or ia32)
 * @param {*} abiName Node abi name (ex: 57, 64, 67 etc)
 * @param {*} destFile Name of the file where the downloaded binary will be saved
 * @param {*} gitsha Git sha for getting specific binaries based on which git revision
 * they were built from
 * @returns Promise that resolves when download succeeds and rejects when download fails
 */
function downloadBinary(platform, arch, abiName, destFile, gitsha) {
  let binaryName;
  if (gitsha) {
    binaryName = [[abiName, pkgJson.version, platform, arch, gitsha].join('-'), 'node'].join('.');
  } else {
    binaryName = [[abiName, pkgJson.version, platform, arch].join('-'), 'node'].join('.');
  }
  const file = fs.createWriteStream(destFile);

  return new Promise(function (resolve, reject) {
    const url = [pkgJson.binary.host, binaryName].join('');
    console.log('Downloading ', url);
    const cb = (response) => {
      const statusCode = response.statusCode;
      if (statusCode === 200) {
        response.pipe(file);
        file.on('finish', function () {
          resolve();
        });
        file.on('error', function (e) {
          reject(e);
        });
      } else {
        reject([url, statusCode]);
      }
    }

    https.get(url, cb).on('error', function (e) {
      console.log(`Got error: ${e.message}`);
      console.log(`Retrying: ${e.message}`);
      https.get(url, cb).on('error', function (e) {
        console.log(`Got error on retry attempt: ${e.message}`);
        reject(e);
      });
    });
  });
}

/**
 * Create `lib` folder in root directory if it doesn't exist
 */
const libDir = path.join(__dirname, '../', 'lib');
if (!fs.existsSync(libDir)) {
  fs.mkdirSync(libDir);
}

/**
 * The prebuilds directory must be hosted inside `lib` directory together with the
 * compiled source code.
 */
const prebuildsDir = path.join(libDir, 'prebuilds');
deleteFolderRecursive(prebuildsDir);
if (!fs.existsSync(prebuildsDir)) {
  fs.mkdirSync(prebuildsDir);
}

readManifestData()
.then((manifest) => {
  const promises = [];
  const binaryMatrix = {
    darwin: ['x64'],
    linux: ['x64'],
    win32: ['x64', 'ia32'],
  };

  // If the tag is set in the manifest, do not fetch gitsha binaries, but tag binaries
  const gitsha = (manifest.tag && manifest.tag !== '') ? undefined : manifest.gitsha;
  Object.keys(binaryMatrix).forEach((platform) => {
    binaryMatrix[platform].forEach((arch) => {
      // Create platform-arch directory to host binaries
      var binaryDir = path.join(prebuildsDir, [platform, arch].join('-'));
      if (!fs.existsSync(binaryDir)) {
        fs.mkdirSync(binaryDir);
      }

      if (installNode) {
        // Download node.napi file from azure
        const abiName = pkgJson.binary.builtVersions[1];
        const destFile = path.join(
          binaryDir,
          [abiName, 'node'].join('.')
        );

        if (!fs.existsSync(destFile)) {
          promises.push(downloadBinary(platform, arch, abiName, destFile, gitsha));
        }
      }

      if (installElectron) {
        // Download electron.napi file from azure
        const abiName = pkgJson.binary.builtVersions[0];
        const destFile = path.join(
          binaryDir,
          [abiName, 'node'].join('.')
        );

        if (!fs.existsSync(destFile)) {
          promises.push(downloadBinary(platform, arch, abiName, destFile, gitsha));
        }
      }
    });
  });

  if (promises.length === 0) {
    console.log('!!! ERROR !!! \t No prebuild binaries downloaded.');
    return;
  }
  Promise.all(promises).then(() => {
    console.log('Binaries installed');
  }).catch((e) => {
    console.log('Error ocurred:', e);
  });
});
