#!/bin/bash
set -x
export BRANCH_NAME=$1
shift
export TRAVIS_COMMIT=$1
shift
export AZURE_STORAGE_ACCESS_KEY=$1
shift
export AZURE_STORAGE_ACCOUNT=$1
shift
export TRAVIS_TAG=$1

export AZURE_CONTAINER="device-api-usb"

prepare_node_env() {
  if ! nvs use 12.4.0; then
    nvs add 12.4.0
    nvs use 12.4.0
  fi
}

source /c/ProgramData/nvs/nvs.sh
prepare_node_env

git submodule update --init --recursive

# source activate py27

npm --add-python-to-path='true' --debug --global --production windows-build-tools
npm ci

npm run napi-64
npm run napi-32

npm run upload-build
