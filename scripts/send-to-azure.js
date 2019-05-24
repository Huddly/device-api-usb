const azure = require('azure-storage');
const path = require('path');

module.exports = (file) => {
  return new Promise((resolve, reject) => {
    if (! process.env.AZURE_STORAGE_ACCESS_KEY || !process.env.AZURE_STORAGE_ACCOUNT || !process.env.AZURE_CONTAINER) {
      console.log('Env variables not set');
      reject('Env variables not set');
    }
    var blobService = azure.createBlobService();
    console.log('Uploading file', path.join(__dirname, '..', file));

    blobService.createBlockBlobFromLocalFile(process.env.AZURE_CONTAINER, path.basename(file), path.join(__dirname, '..', file), function(error, result, response) {
        if (!error) {
          if (result) {
            resolve(result);
          }
          else {
            resolve('Share already existed');
          }
        }
      else {
        reject(error);
      }
    });
  });
}
