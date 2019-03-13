[![Build Status](https://travis-ci.com/Huddly/device-api-usb.svg?branch=master)](https://travis-ci.com/Huddly/device-api-usb) [![Greenkeeper badge](https://badges.greenkeeper.io/Huddly/device-api-usb.svg)](https://greenkeeper.io/)

# Huddly SDK - Device Api USB

### Development setup
If you want to local development together with the @huddly/sdk here is the recommend setup

- Checkout Device Api USB repo and the sdk repo
- run npm install in both repos, use the same node version recommend v10.12
- Go into the Device Api USB repo, run ```npm link``` this will create a symlink to this repo in the npm cache
- Then start the typescript compiler watcher ```npm run watch-ts```
- Open a new tab
- Go to the SDK repo folder, run ```npm link @huddly/device-api-usb```.
- Start the typescript watcher ```npm run watch-ts```

Now you can change things in the sdk and the Device Api USB folder and your changes will be reflected in the compiled code in the sdk.
