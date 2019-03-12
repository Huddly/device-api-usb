#!/bin/bash -l

git submodule update --init --recursive

export NODEJS_ORG_MIRROR=http://nodejs.org/dist

nvm install 10.15.2
nvm use 10.15.2

npm install

npm run napi

if [ "$RELEASE" = "true" ]
then
  ./scripts/commit_artifacts.sh
fi
