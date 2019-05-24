#!/bin/bash
# run from the clijs folder
set -x
export AZURE_STORAGE_ACCOUNT=$1
shift
export AZURE_STORAGE_ACCESS_KEY=$1
shift
export BRANCH_NAME=$1
source /c/ProgramData/nvs/nvs.sh
nvs use 10.12.0

git submodule update --init --recursive

# source activate py27

npm install -g windows-build-tools
npm install

ARCH=x64 npm run napi
ARCH=ia32 npm run napi

# if [ "$RELEASE" = "true" ]
# then
#   ./scripts/commit_artifacts.sh
# fi

# npm ci
# TARGETOS=win PREBUILDS_OS=win32 ./build.sh
