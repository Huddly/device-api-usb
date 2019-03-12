#!/bin/bash -l

set -u #Do not allow unset variables
set -x #Print commands
set -e #Exit on error

git submodule update --init --recursive

nvm install 10.15.2
nvm use 10.15.2

source activate py27

npm install --python=/usr/bin/python2.7

npm run napi

if [ "$RELEASE" = "true" ]
then
  ./scripts/commit_artifacts.sh
fi
