const azure = require('azure-storage');
const fs = require('fs');
const path = require('path');

module.exports = (file) => {
  return new Promise((resolve, reject) => {
    if (! process.env.AZURE_STORAGE_ACCESS_KEY || !process.env.AZURE_STORAGE_ACCOUNT) {
      console.log('Env variables not set');
      reject('Env variables not set');
    }
    var blobService = azure.createBlobService();
    blobService.createBlockBlobFromLocalFile('node-uvc', path.basename(file) ,file, function(error, result, response) {
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
