
<p>
  <a href="https://travis-ci.com/Huddly/device-api-usb"><img src="https://travis-ci.com/Huddly/device-api-usb.svg?branch=master" alt="Build Status"></a>
  <a href="https://www.npmjs.com/package/@huddly/device-api-usb"><img src="https://badge.fury.io/js/%40huddly%2Fdevice-api-usb.svg" alt="npm badge"></a>
  <a href="https://img.shields.io/david/Huddly/device-api-usb"><img src="https://img.shields.io/david/Huddly/device-api-usb.svg" alt="npm dependencies"></a>
  <a href="https://img.shields.io/david/dev/Huddly/device-api-usb"><img src="https://img.shields.io/david/dev/Huddly/device-api-usb.svg" alt="npm devDependencies"></a>
  <a href="https://npmcharts.com/compare/@huddly/device-api-usb?minimal=true"><img src="https://img.shields.io/npm/dm/@huddly/device-api-usb.svg?style=flat" alt="NPM Downloads"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-brightgreen.svg" alt="MIT badge"></a>
  <a href="http://commitizen.github.io/cz-cli/"><img src="https://img.shields.io/badge/commitizen-friendly-brightgreen.svg" alt="Commitizen badge"></a>
</p>

# Huddly SDK - Device Api USB

>[!IMPORTANT]  
>
><b>No longer in active developement.</b> We strongly recommend using the [.NET-SDK](https://developer.huddly.com/) going forward.
></br>
></br>
In an effort to meet future demand for how we interact and communicate with our USB devices, we are modernizing our software development kit (SDK). Part of this process is switching over to the .NET framework. The new SDK has the capability to communicate with a proxy service that we run on Windows hosts. The purpose of this proxy service is to bypass a limitation where only one client can communicate with a usb device at any given time. This makes it possible for ours and anyone else's software to communicate with our devices in parallel, without the software clients getting in the way of each other. This services is gradually rolling out on all Windows systems using cameras connected through the Huddly USB Adapter. 
></br>
></br>
By the end of the year (2024) the USB proxy will be installed on all Windows systems using a Huddly IQ or camera connected through the Huddly USB Adapter. Using the JS-SDK to integrate with IQ or Huddly USB Adapter connected cameras will no longer be possible on these hosts.

## Development

First clone the repo.

Then you need to init and update the submodules
```
  git submodule init
  git submodule update
```

Setup dependcies
```
npm i
```


## Windows
Then you need to make sure you have build tools for windows


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


## Licence
[MIT](LICENCE)
Note that the compiled Node extension includes Libusb, and is thus subject to the LGPL.
