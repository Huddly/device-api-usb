#!/bin/bash
# run from the clijs folder
set -x
export BRANCH_NAME=$1
shift
export TRAVIS_COMMIT=$1
shift
export AZURE_STORAGE_ACCESS_KEY=$1
shift
export AZURE_STORAGE_ACCOUNT=$1

export AZURE_CONTAINER="device-api-usb"

source /c/ProgramData/nvs/nvs.sh
nvs use 10.12.0

git submodule update --init --recursive

# source activate py27

npm install -g windows-build-tools
npm install

ARCH=x64 npm run napi
ARCH=ia32 npm run napi

npm run upload-build
