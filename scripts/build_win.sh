#!/bin/bash -l

set -u #Do not allow unset variables
set -x #Print commands
set -e #Exit on error

git submodule update --init --recursive

nvm install 10.15.2
nvm use 10.15.2

source activate py27

npm install -g windows-build-tools
npm install

ARCH=x64 npm run napi
ARCH=ia32 npm run napi

if [ "$RELEASE" = "true" ]
then
  ./scripts/commit_artifacts.sh
fi
