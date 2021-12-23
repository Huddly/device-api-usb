const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');

process.on('unhandledRejection', (up) => {
  throw up;
});

/**
 * Convenience function that creates a manifest.json
 * file in the root directory of the project. The info
 * in this file is used for downloading prebuild binaries
 * for the latest released tag (project version)
 *
 * @param {*} destDir Directory where the manifest is saved
 * @param {boolean} [production=false] Whether the file will be part of a released npm version
 * @param {*} [gitsha=undefined] Optional gitsha to be added to the manifest file (only for non prod
 * releases)
 * @returns
 */
function createManifestFile(destDir, production = false, gitsha = undefined) {
  let manifestContent = {};
  if (production) {
    manifestContent = {
      tag: pkg.version,
    }
  } else {
    const tag = (!process.env.RELEASE_VERSION || process.env.RELEASE_VERSION === 'false') ? '' : process.env.RELEASE_VERSION;
    manifestContent = {
      tag,
      gitsha,
    }
  }

  return new Promise((resolve, reject) => {
    fs.writeFile(path.join(destDir, 'manifest.json'), JSON.stringify(manifestContent), 'utf8', (err) => {
      if (err) {
        return reject(err);
      }
      console.log('::: manifest.json file saved to: ', path.join(destDir, 'manifest.json'));
      resolve();
    });
  });
}

if (process.env.PROD_MANIFEST) {
  Promise.all([
    createManifestFile('.', true)
  ]);
}

module.exports = {
  createManifestFile,
};
